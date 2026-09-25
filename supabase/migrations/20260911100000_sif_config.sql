-- =============================================================================
-- V03 · Verifactu · 1/5 — sif_config: configuración del SIF por obligado
-- Base legal: art. 10.1.l RD 1007/2023 (SistemaInformatico), art. 16-17 Orden
-- HAC/1177/2024 (control de flujo, inicio/renuncia VERI*FACTU). SPEC.md §2.4, §5.3, D-10, D-13.
-- Tenant = auth.users (cada usuario de Kuentas es un obligado tributario).
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración (regla V03).
-- =============================================================================

create table if not exists public.sif_config (
  user_id uuid primary key references auth.users(id) on delete restrict,
  -- Identificación del obligado a expedir factura (art. 10.1.a-b RD 1007/2023)
  nif_obligado text not null check (nif_obligado ~ '^[A-Z0-9]{9}$'),
  nombre_razon text not null check (char_length(nombre_razon) between 1 and 120),
  -- Modalidad: v1 opera SOLO como VERI*FACTU (decisión D1 del plan maestro; no_verifactu se evalúa en V14)
  modalidad text not null default 'verifactu' check (modalidad in ('verifactu', 'no_verifactu')),
  -- Entorno AEAT (D-13): todo desarrollo/QA contra 'pruebas'; 'produccion' solo tras V17-V18 y decisión de Iván
  entorno_aeat text not null default 'pruebas' check (entorno_aeat in ('pruebas', 'produccion')),
  -- NumeroInstalacion del bloque SistemaInformatico (≤100, único por obligado en este SaaS multi-tenant)
  numero_instalacion text not null check (char_length(numero_instalacion) between 1 and 100),
  -- Referencia OPACA al certificado usado para remitir (gestión y custodia en V11).
  -- NUNCA el certificado ni claves aquí: solo un identificador.
  certificado_ref text,
  -- Inicio y fin (renuncia) del funcionamiento como VERI*FACTU (art. 17 Orden HAC/1177/2024)
  fecha_inicio_verifactu date,
  fecha_fin_verifactu date,
  -- Control de flujo de remisión (art. 16 Orden): último TiempoEsperaEnvio recibido de la AEAT
  -- (valor inicial 60 s) y el instante antes del cual NO se debe enviar el siguiente mensaje.
  tiempo_espera_envio integer not null default 60 check (tiempo_espera_envio > 0),
  proximo_envio_desde timestamptz,
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sif_config_fin_verifactu_chk
    check (fecha_fin_verifactu is null or fecha_inicio_verifactu is not null)
);

comment on table public.sif_config is
  'Configuración Verifactu por obligado tributario (tenant). Un registro por usuario emisor.';
comment on column public.sif_config.certificado_ref is
  'Referencia opaca al certificado de remisión (custodia en V11). Prohibido almacenar material criptográfico.';

-- updated_at automático (reutilizable por el resto de tablas sif_*)
create or replace function public.sif_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sif_config_touch on public.sif_config;
create trigger sif_config_touch
  before update on public.sif_config
  for each row execute function public.sif_touch_updated_at();

-- RLS multi-tenant estricta: el usuario solo ve y gestiona SU configuración.
-- (El guard que impide cambiar nif_obligado/numero_instalacion con cadena iniciada
--  se crea en la migración 3/5, cuando ya existe sif_registros.)
alter table public.sif_config enable row level security;

drop policy if exists "sif_config select own" on public.sif_config;
create policy "sif_config select own" on public.sif_config
  for select using (auth.uid() = user_id);

drop policy if exists "sif_config insert own" on public.sif_config;
create policy "sif_config insert own" on public.sif_config
  for insert with check (auth.uid() = user_id);

drop policy if exists "sif_config update own" on public.sif_config;
create policy "sif_config update own" on public.sif_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sin policy de DELETE: la configuración no se borra desde el cliente.
revoke delete, truncate on table public.sif_config from anon, authenticated;
