-- =============================================================================
-- V03 · Verifactu · 4/5 — sif_outbox (cola de remisión) + sif_eventos
-- Base legal: art. 16 RRSIF y art. 16 Orden HAC/1177/2024 (remisión continua,
-- lotes ≤1000, TiempoEsperaEnvio, reintentos ≥1/hora, Incidencia=S); art. 8.4
-- RRSIF y art. 9 Orden (eventos — EXENTO en VERI*FACTU por art. 3 Orden; la
-- tabla queda preparada para el modo no-VERI*FACTU de V14). SPEC.md §5, §7, D-04.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sif_outbox: patrón outbox. Cada registro generado se encola en la MISMA
-- transacción de emisión (D-02/D-04); el worker de V10 lo agrupa en lotes ≤1000
-- por obligado respetando el control de flujo de sif_config.
-- -----------------------------------------------------------------------------
create table if not exists public.sif_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  registro_id uuid not null unique references public.sif_registros(id) on delete restrict,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_envio', 'enviado', 'error')),
  lote_id uuid,                                   -- agrupación del envío (≤1000 registros)
  intentos integer not null default 0 check (intentos >= 0),
  ultimo_error text,
  ultimo_intento_at timestamptz,
  proximo_intento_at timestamptz not null default now(),  -- backoff / reintento ≥1 vez por hora
  incidencia boolean not null default false,      -- generado durante caída → Incidencia=S al remitir
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sif_outbox is
  'Cola de remisión VERI*FACTU (art. 16 Orden HAC/1177/2024). Una fila por registro pendiente de confirmar.';

create index if not exists sif_outbox_despacho_idx
  on public.sif_outbox (estado, proximo_intento_at);
create index if not exists sif_outbox_user_idx
  on public.sif_outbox (user_id, estado);
create index if not exists sif_outbox_lote_idx
  on public.sif_outbox (lote_id) where lote_id is not null;

drop trigger if exists sif_outbox_touch on public.sif_outbox;
create trigger sif_outbox_touch
  before update on public.sif_outbox
  for each row execute function public.sif_touch_updated_at();

alter table public.sif_outbox enable row level security;

drop policy if exists "sif_outbox select own" on public.sif_outbox;
create policy "sif_outbox select own" on public.sif_outbox
  for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on table public.sif_outbox from anon, authenticated;

-- -----------------------------------------------------------------------------
-- sif_eventos: registro de eventos del SIF (art. 9 Orden). Kuentas v1 (solo
-- VERI*FACTU) está EXENTO (art. 3 Orden); se crea ya la estructura para V14.
-- Cadena de huellas PROPIA, separada de la de facturación. Totalmente inmutable.
-- -----------------------------------------------------------------------------
create table if not exists public.sif_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  correlativo bigint not null check (correlativo >= 1),
  -- Tipos del art. 9.1 Orden (a-i) + resumen periódico cada 6 h (art. 9.2)
  tipo_evento text not null check (tipo_evento in (
    'inicio_no_verifactu', 'fin_no_verifactu',
    'deteccion_anomalias_registros', 'anomalia_registro',
    'deteccion_anomalias_eventos', 'anomalia_evento',
    'restauracion_copia', 'export_registros', 'export_eventos',
    'resumen_periodico'
  )),
  datos jsonb not null default '{}'::jsonb,
  primer_evento boolean not null default false,
  huella_anterior text check (huella_anterior ~ '^[0-9A-F]{64}$'),
  tipo_huella text not null default '01' check (tipo_huella = '01'),
  huella text not null check (huella ~ '^[0-9A-F]{64}$'),
  fecha_hora_huso_gen text not null
    check (fecha_hora_huso_gen ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$'),
  generado_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sif_eventos_encadenamiento_chk check (
    (primer_evento and huella_anterior is null)
    or ((not primer_evento) and huella_anterior is not null)
  ),
  constraint sif_eventos_user_correlativo_uq unique (user_id, correlativo)
);

comment on table public.sif_eventos is
  'Registro de eventos del SIF (art. 9 Orden HAC/1177/2024). Exento en VERI*FACTU (art. 3); preparado para V14. Append-only total.';

create or replace function public.sif_eventos_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'sif_eventos es append-only: UPDATE/DELETE prohibidos (art. 8.2 RD 1007/2023)';
end;
$$;

drop trigger if exists sif_eventos_guard_upd on public.sif_eventos;
create trigger sif_eventos_guard_upd
  before update on public.sif_eventos
  for each row execute function public.sif_eventos_guard();

drop trigger if exists sif_eventos_guard_del on public.sif_eventos;
create trigger sif_eventos_guard_del
  before delete on public.sif_eventos
  for each row execute function public.sif_eventos_guard();

drop trigger if exists sif_eventos_guard_trunc on public.sif_eventos;
create trigger sif_eventos_guard_trunc
  before truncate on public.sif_eventos
  for each statement execute function public.sif_no_truncate();

alter table public.sif_eventos enable row level security;

drop policy if exists "sif_eventos select own" on public.sif_eventos;
create policy "sif_eventos select own" on public.sif_eventos
  for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on table public.sif_eventos from anon, authenticated;
