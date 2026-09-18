-- =============================================================================
-- V11 · Verifactu — sif_certificados: custodia cifrada del certificado de
-- remisión de cada obligado (art. 5 Orden HAC/1177/2024: la remisión a la AEAT
-- exige autenticación mutua TLS con certificado electrónico).
--
-- Diseño (docs/verifactu/SEGURIDAD-CERTS.md):
--  * El material (PKCS#12 o PEM normalizado) viaja SIEMPRE cifrado con
--    AES-256-GCM en la aplicación (KEK en variable de entorno, nunca en BD):
--    esta tabla solo ve el sobre «v1.<kek>.<iv>.<ct>.<tag>». Un volcado de la
--    base de datos NO expone claves privadas.
--  * RLS deny-all: ni anon ni authenticated tienen NINGÚN privilegio (ni
--    SELECT). Todo acceso pasa por la API del servidor (service_role), que
--    autentica al usuario y solo le devuelve metadatos, jamás material.
--  * Write-once: la única mutación permitida es retirar (activo→retirado),
--    que además purga el material cifrado. DELETE/TRUNCATE bloqueados para
--    todos los roles (rastro de auditoría de qué certificado se usó y cuándo).
--  * Un único certificado activo por obligado (índice parcial).
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

create table if not exists public.sif_certificados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  -- Titularidad frente al obligado de sif_config (§4.3 del plan maestro):
  --   obligado      → el certificado es del propio obligado (opción A, v1)
  --   representante → certificado de representante (opción B, soporte futuro)
  --   sello         → certificado de sello de entidad (endpoints www10/prewww10)
  tipo text not null default 'obligado' check (tipo in ('obligado', 'representante', 'sello')),
  -- Formato del material custodiado: 'pem' (clave PKCS#8 + cadena, normalizado
  -- en la subida) o 'pfx' (PKCS#12 original + passphrase, si no fue posible
  -- normalizar). El material y la passphrase van SIEMPRE dentro del sobre.
  formato text not null check (formato in ('pem', 'pfx')),
  -- Sobre AES-256-GCM «v1.<kekId>.<iv>.<ct>.<tag>» (lib/verifactu/cert-cifrado.ts).
  -- NULL solo tras retirar (purga de material).
  material_cifrado text,
  -- Metadatos EN CLARO del certificado (nunca sensibles: son públicos en el
  -- propio certificado). Permiten validar caducidad y auditar sin descifrar.
  subject_cn text not null,
  nif_certificado text,
  nif_representado text,
  emisor_cn text,
  numero_serie text not null,
  huella_sha256 text not null check (huella_sha256 ~ '^[0-9A-F]{64}$'),
  valido_desde timestamptz not null,
  valido_hasta timestamptz not null,
  estado text not null default 'activo' check (estado in ('activo', 'retirado')),
  retirado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sif_certificados_validez_chk check (valido_desde < valido_hasta),
  constraint sif_certificados_retirado_chk
    check ((estado = 'retirado') = (retirado_at is not null)),
  -- Un certificado activo debe conservar su material; retirado, purgado.
  constraint sif_certificados_material_chk
    check (estado = 'retirado' or material_cifrado is not null)
);

comment on table public.sif_certificados is
  'Custodia cifrada (AES-256-GCM, KEK en env) del certificado de remisión VERI*FACTU por obligado. Acceso solo service_role vía API.';
comment on column public.sif_certificados.material_cifrado is
  'Sobre v1.<kekId>.<iv>.<ct>.<tag>. PROHIBIDO almacenar aquí material en claro.';

-- Un único certificado activo por obligado
create unique index if not exists sif_certificados_activo_unico
  on public.sif_certificados (user_id) where estado = 'activo';

create index if not exists sif_certificados_user_idx
  on public.sif_certificados (user_id, created_at desc);

drop trigger if exists sif_certificados_touch on public.sif_certificados;
create trigger sif_certificados_touch
  before update on public.sif_certificados
  for each row execute function public.sif_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Guard write-once (aplica a TODOS los roles, incluido service_role):
-- la única transición permitida es activo→retirado (fija retirado_at y purga
-- material_cifrado); el resto de columnas son inmutables. DELETE prohibido.
-- -----------------------------------------------------------------------------
create or replace function public.sif_certificados_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'sif_certificados es de solo adición: retire el certificado (estado=retirado), no lo borre';
  end if;

  -- Columnas inmutables siempre
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.tipo is distinct from old.tipo
     or new.formato is distinct from old.formato
     or new.subject_cn is distinct from old.subject_cn
     or new.nif_certificado is distinct from old.nif_certificado
     or new.nif_representado is distinct from old.nif_representado
     or new.emisor_cn is distinct from old.emisor_cn
     or new.numero_serie is distinct from old.numero_serie
     or new.huella_sha256 is distinct from old.huella_sha256
     or new.valido_desde is distinct from old.valido_desde
     or new.valido_hasta is distinct from old.valido_hasta
     or new.created_at is distinct from old.created_at then
    raise exception 'sif_certificados: los metadatos del certificado son inmutables (suba un certificado nuevo)';
  end if;

  if old.estado = 'retirado' then
    raise exception 'sif_certificados: un certificado retirado es inmutable';
  end if;

  if new.estado is distinct from old.estado then
    if new.estado <> 'retirado' then
      raise exception 'sif_certificados: transición de estado no permitida (solo activo→retirado)';
    end if;
    -- Retirada: exige purga del material y sella el instante
    new.retirado_at := coalesce(new.retirado_at, now());
    new.material_cifrado := null;
  else
    -- Sin cambio de estado: el material cifrado es write-once
    if new.material_cifrado is distinct from old.material_cifrado then
      raise exception 'sif_certificados: el material cifrado no se modifica; retire el certificado y suba uno nuevo';
    end if;
    if new.retirado_at is distinct from old.retirado_at then
      raise exception 'sif_certificados: retirado_at solo se fija al retirar';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sif_certificados_guard_upd on public.sif_certificados;
create trigger sif_certificados_guard_upd
  before update on public.sif_certificados
  for each row execute function public.sif_certificados_guard();

drop trigger if exists sif_certificados_guard_del on public.sif_certificados;
create trigger sif_certificados_guard_del
  before delete on public.sif_certificados
  for each row execute function public.sif_certificados_guard();

drop trigger if exists sif_certificados_guard_trunc on public.sif_certificados;
create trigger sif_certificados_guard_trunc
  before truncate on public.sif_certificados
  for each statement execute function public.sif_no_truncate();

-- -----------------------------------------------------------------------------
-- RLS deny-all para clientes: RLS activada SIN policies + revoke total.
-- Ni siquiera SELECT: el material cifrado no debe salir por PostgREST; los
-- metadatos los sirve la API del servidor tras autenticar al usuario.
-- -----------------------------------------------------------------------------
alter table public.sif_certificados enable row level security;
revoke all on table public.sif_certificados from anon, authenticated;
