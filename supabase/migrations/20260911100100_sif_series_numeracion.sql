-- =============================================================================
-- V03 · Verifactu · 2/5 — sif_series: numeración correlativa en servidor (D-01)
-- Base legal: art. 6.1.a RD 1619/2012 (numeración correlativa, series); corrige el
-- riesgo R1 de V01 (numeración en cliente vía localStorage). SPEC.md D-01, D-02.
-- =============================================================================

create table if not exists public.sif_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  serie text not null check (serie ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  ejercicio integer not null check (ejercicio between 2000 and 2100),
  tipo text not null default 'ordinaria' check (tipo in ('ordinaria', 'rectificativa')),
  ultimo_numero integer not null default 0 check (ultimo_numero >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, serie, ejercicio)
);

comment on table public.sif_series is
  'Contadores de numeración por (obligado, serie, ejercicio). Reserva atómica vía sif_reservar_numero().';

drop trigger if exists sif_series_touch on public.sif_series;
create trigger sif_series_touch
  before update on public.sif_series
  for each row execute function public.sif_touch_updated_at();

-- Reserva atómica de número: INSERT..ON CONFLICT DO UPDATE toma bloqueo de fila,
-- por lo que dos emisiones concurrentes de la misma serie se serializan y nunca
-- obtienen el mismo número. Devuelve el número y el NumSerieFactura formateado
-- (formato D-01: SERIE-EJERCICIO-NNNNNN, ≤60 ASCII, p. ej. F-2027-000123).
create or replace function public.sif_reservar_numero(
  p_user_id uuid,
  p_serie text,
  p_ejercicio integer,
  p_tipo text default 'ordinaria'
)
returns table (numero integer, num_serie_factura text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  -- Solo el propio usuario (JWT) o el backend con service_role (auth.uid() null).
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'sif_reservar_numero: user_id no coincide con el usuario autenticado';
  end if;

  insert into public.sif_series as s (user_id, serie, ejercicio, tipo, ultimo_numero)
  values (p_user_id, upper(p_serie), p_ejercicio, p_tipo, 1)
  on conflict (user_id, serie, ejercicio)
  do update set ultimo_numero = s.ultimo_numero + 1, updated_at = now()
  returning s.ultimo_numero into v_num;

  return query
    select v_num,
           format('%s-%s-%s', upper(p_serie), p_ejercicio, lpad(v_num::text, 6, '0'));
end;
$$;

revoke all on function public.sif_reservar_numero(uuid, text, integer, text) from public;
revoke all on function public.sif_reservar_numero(uuid, text, integer, text) from anon;
grant execute on function public.sif_reservar_numero(uuid, text, integer, text) to authenticated, service_role;

-- RLS: lectura solo de las series propias; escritura únicamente vía función
-- (security definer) o service_role — sin policies de INSERT/UPDATE/DELETE.
alter table public.sif_series enable row level security;

drop policy if exists "sif_series select own" on public.sif_series;
create policy "sif_series select own" on public.sif_series
  for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on table public.sif_series from anon, authenticated;
