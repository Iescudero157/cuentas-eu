-- =============================================================================
-- V03 · Verifactu · 3/5 — sif_cadena + sif_registros (núcleo del módulo)
-- Base legal: arts. 8.2, 9-12 RD 1007/2023 (RRSIF); arts. 6, 7, 10, 11, 13 y 16
-- Orden HAC/1177/2024. SPEC.md §2-§5, D-03 (append-only), D-05 (cadena por obligado),
-- D-06 (fecha-hora con huso). Registros INMUTABLES: solo se permite evolucionar el
-- estado de remisión; el contenido oficial y la huella jamás cambian.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sif_cadena: puntero al último eslabón de la cadena de huellas de cada obligado
-- (art. 7 Orden). Altas y anulaciones comparten UNA cadena por NIF emisor. La
-- generación de registros (V07) hace SELECT ... FOR UPDATE de esta fila para
-- serializar el encadenamiento.
-- -----------------------------------------------------------------------------
create table if not exists public.sif_cadena (
  user_id uuid primary key references auth.users(id) on delete restrict,
  nif_obligado text not null check (nif_obligado ~ '^[A-Z0-9]{9}$'),
  correlativo_ultimo bigint not null default 0 check (correlativo_ultimo >= 0),
  ultimo_registro_id uuid,               -- FK a sif_registros añadida más abajo
  ultima_huella text check (ultima_huella ~ '^[0-9A-F]{64}$'),
  ultimo_num_serie_factura text,
  ultima_fecha_expedicion date,
  updated_at timestamptz not null default now()
);

comment on table public.sif_cadena is
  'Estado de la cadena de huellas por obligado (art. 7 Orden HAC/1177/2024). Bloquear con FOR UPDATE al generar.';

-- -----------------------------------------------------------------------------
-- sif_registros: registros de facturación de alta y anulación. Append-only.
-- -----------------------------------------------------------------------------
create table if not exists public.sif_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  -- Posición en la cadena del obligado (1..n, altas y anulaciones juntas)
  correlativo bigint not null check (correlativo >= 1),
  tipo_registro text not null check (tipo_registro in ('alta', 'anulacion')),
  invoice_id uuid references public.invoices(id) on delete restrict,

  -- Identificación oficial de la factura (art. 10.1.a / art. 11 RRSIF)
  id_emisor_factura text not null check (id_emisor_factura ~ '^[A-Z0-9]{9}$'),
  num_serie_factura text not null check (char_length(num_serie_factura) between 1 and 60),
  fecha_expedicion date not null,
  -- Solo alta (lista L2, art. 10.1.c RRSIF)
  tipo_factura text check (tipo_factura in ('F1','F2','F3','R1','R2','R3','R4','R5')),
  cuota_total numeric(14,2),
  importe_total numeric(14,2),

  -- Contenido oficial COMPLETO del registro (todos los campos de SPEC §2.1/§3),
  -- fuente única para generar el XML en V05/V06.
  registro jsonb not null,
  -- XML exacto remitido a la AEAT. Se fija una única vez (NULL -> valor) y queda inmutable.
  xml text,

  -- Encadenamiento y huella (arts. 7 y 13 Orden; art. 12 RRSIF; SPEC §4)
  primer_registro boolean not null default false,
  huella_anterior text check (huella_anterior ~ '^[0-9A-F]{64}$'),
  tipo_huella text not null default '01' check (tipo_huella = '01'),  -- 01 = SHA-256
  huella text not null check (huella ~ '^[0-9A-F]{64}$'),
  -- FechaHoraHusoGenRegistro EXACTA a la usada en la huella y el XML (art. 10.1.m RRSIF)
  fecha_hora_huso_gen text not null
    check (fecha_hora_huso_gen ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$'),
  generado_at timestamptz not null default now(),   -- epoch UTC (D-06)

  -- Flags de reenvío/subsanación (doc. «Validaciones y errores» AEAT; SPEC §5.4)
  subsanacion boolean not null default false,
  rechazo_previo text check (rechazo_previo in ('N','S','X')),

  -- Estado de remisión VERI*FACTU (máquina de estados SPEC §5.5) — ÚNICO bloque mutable
  estado_remision text not null default 'generated'
    check (estado_remision in ('generated','queued','sending','accepted','accepted_with_errors','rejected')),
  incidencia boolean not null default false,        -- Incidencia=S, art. 16 Orden
  csv_aeat text,
  respuesta_aeat jsonb,
  codigo_error_registro text,
  descripcion_error text,
  remitido_at timestamptz,

  created_at timestamptz not null default now(),

  -- Un alta lleva siempre tipo de factura e importes (art. 10 RRSIF)
  constraint sif_registros_alta_chk check (
    tipo_registro <> 'alta'
    or (tipo_factura is not null and cuota_total is not null and importe_total is not null)
  ),
  -- Primer registro de la cadena sin huella anterior; el resto siempre con ella (art. 7 Orden)
  constraint sif_registros_encadenamiento_chk check (
    (primer_registro and huella_anterior is null)
    or ((not primer_registro) and huella_anterior is not null)
  ),
  -- Índice/unicidad obligado + correlativo (requisito V03)
  constraint sif_registros_user_correlativo_uq unique (user_id, correlativo)
);

comment on table public.sif_registros is
  'Registros de facturación de alta/anulación (arts. 9-11 RRSIF). Append-only: UPDATE de contenido y DELETE bloqueados por trigger.';

alter table public.sif_cadena
  drop constraint if exists sif_cadena_ultimo_registro_fk;
alter table public.sif_cadena
  add constraint sif_cadena_ultimo_registro_fk
  foreign key (ultimo_registro_id) references public.sif_registros(id) on delete restrict;

create index if not exists sif_registros_user_estado_idx
  on public.sif_registros (user_id, estado_remision);
create index if not exists sif_registros_invoice_idx
  on public.sif_registros (invoice_id);
create index if not exists sif_registros_emisor_factura_idx
  on public.sif_registros (id_emisor_factura, fecha_expedicion, num_serie_factura);

-- -----------------------------------------------------------------------------
-- Inmutabilidad (art. 8.2 RRSIF; art. 6 Orden): DELETE prohibido siempre;
-- UPDATE solo del bloque de remisión (y xml una única vez NULL -> valor).
-- El trigger aplica a TODOS los roles, incluido service_role.
-- -----------------------------------------------------------------------------
create or replace function public.sif_registros_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'sif_registros es append-only: DELETE prohibido (art. 8.2 RD 1007/2023). Use un registro de anulación.';
  end if;

  if new.id <> old.id
     or new.user_id <> old.user_id
     or new.correlativo <> old.correlativo
     or new.tipo_registro <> old.tipo_registro
     or new.invoice_id is distinct from old.invoice_id
     or new.id_emisor_factura <> old.id_emisor_factura
     or new.num_serie_factura <> old.num_serie_factura
     or new.fecha_expedicion <> old.fecha_expedicion
     or new.tipo_factura is distinct from old.tipo_factura
     or new.cuota_total is distinct from old.cuota_total
     or new.importe_total is distinct from old.importe_total
     or new.registro is distinct from old.registro
     or (old.xml is not null and new.xml is distinct from old.xml)
     or new.primer_registro <> old.primer_registro
     or new.huella_anterior is distinct from old.huella_anterior
     or new.tipo_huella <> old.tipo_huella
     or new.huella <> old.huella
     or new.fecha_hora_huso_gen <> old.fecha_hora_huso_gen
     or new.generado_at <> old.generado_at
     or new.subsanacion <> old.subsanacion
     or new.rechazo_previo is distinct from old.rechazo_previo
     or new.created_at <> old.created_at
  then
    raise exception 'sif_registros es inmutable: solo puede evolucionar el estado de remisión (art. 8.2 RD 1007/2023; art. 6 Orden HAC/1177/2024)';
  end if;

  return new;
end;
$$;

create or replace function public.sif_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'TRUNCATE prohibido en tablas de registros Verifactu (art. 8.2 RD 1007/2023)';
end;
$$;

drop trigger if exists sif_registros_guard_upd on public.sif_registros;
create trigger sif_registros_guard_upd
  before update on public.sif_registros
  for each row execute function public.sif_registros_guard();

drop trigger if exists sif_registros_guard_del on public.sif_registros;
create trigger sif_registros_guard_del
  before delete on public.sif_registros
  for each row execute function public.sif_registros_guard();

drop trigger if exists sif_registros_guard_trunc on public.sif_registros;
create trigger sif_registros_guard_trunc
  before truncate on public.sif_registros
  for each statement execute function public.sif_no_truncate();

-- -----------------------------------------------------------------------------
-- Guard de sif_config (pendiente de la migración 1/5): con la cadena iniciada no
-- puede cambiar la identidad del obligado ni de la instalación.
-- -----------------------------------------------------------------------------
create or replace function public.sif_config_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.user_id <> old.user_id
      or new.nif_obligado <> old.nif_obligado
      or new.numero_instalacion <> old.numero_instalacion)
     and exists (select 1 from public.sif_registros r where r.user_id = old.user_id)
  then
    raise exception 'sif_config: nif_obligado/numero_instalacion no pueden cambiar con registros ya generados (integridad de la cadena, art. 7 Orden HAC/1177/2024)';
  end if;
  return new;
end;
$$;

drop trigger if exists sif_config_guard_upd on public.sif_config;
create trigger sif_config_guard_upd
  before update on public.sif_config
  for each row execute function public.sif_config_guard();

-- -----------------------------------------------------------------------------
-- RLS multi-tenant estricta: el usuario SOLO lee sus registros y su cadena.
-- Escrituras exclusivamente desde el servidor (service_role, bypassa RLS pero
-- NO los triggers). Sin policies de INSERT/UPDATE/DELETE + revoke explícito.
-- -----------------------------------------------------------------------------
alter table public.sif_registros enable row level security;
alter table public.sif_cadena enable row level security;

drop policy if exists "sif_registros select own" on public.sif_registros;
create policy "sif_registros select own" on public.sif_registros
  for select using (auth.uid() = user_id);

drop policy if exists "sif_cadena select own" on public.sif_cadena;
create policy "sif_cadena select own" on public.sif_cadena
  for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on table public.sif_registros from anon, authenticated;
revoke insert, update, delete, truncate on table public.sif_cadena from anon, authenticated;
