-- Conexiones con IA (conector MCP) y API v1 de Kuentas — 27-nov-2026.
--
-- Cuatro tablas:
--   api_tokens             tokens personales (kua_…); solo se guarda su SHA-256. Los crea el servidor.
--   api_codigos_conexion   códigos de un solo uso (2 min) que /conectar-ia da al conector MCP para canjearlos.
--   api_registro           una fila por llamada a la API v1 (quién, qué ruta, resultado, tiempo). Sin contenido.
--   facturas_borrador_ia   borradores que prepara la IA. NO son facturas: no tienen número ni registro
--                          VERI*FACTU. El usuario los revisa y los convierte en factura desde la app.
-- Regla de producto (Iván, 26-nov): la IA nunca emite una factura.
--
-- Compatible hacia atrás: no toca tablas existentes. Se aplica en el SQL Editor de Supabase (lo pulsa Iván).

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 120),
  origen text not null default 'manual' check (origen in ('manual', 'mcp')),
  hash text not null unique check (hash ~ '^[0-9a-f]{64}$'),
  prefijo text not null check (char_length(prefijo) between 4 and 16),
  permisos text[] not null
    check (permisos <@ array['kuentas:leer', 'kuentas:borradores']::text[] and 'kuentas:leer' = any (permisos)),
  creado_at timestamptz not null default now(),
  ultimo_uso_at timestamptz,
  revocado_at timestamptz
);
create index if not exists api_tokens_user_idx on public.api_tokens (user_id);
comment on table public.api_tokens is
  'Tokens personales de la API v1 y del conector MCP. Solo el hash SHA-256; el token se muestra una vez.';

create table if not exists public.api_codigos_conexion (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  permisos text[] not null
    check (permisos <@ array['kuentas:leer', 'kuentas:borradores']::text[] and 'kuentas:leer' = any (permisos)),
  cliente text not null default 'Asistente de IA' check (char_length(cliente) <= 120),
  caduca_at timestamptz not null,
  usado_at timestamptz,
  creado_at timestamptz not null default now()
);

create table if not exists public.api_registro (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.api_tokens(id) on delete set null,
  metodo text not null check (metodo in ('GET', 'POST')),
  ruta text not null check (char_length(ruta) <= 200),
  estado integer not null,
  ms integer,
  creado_at timestamptz not null default now()
);
create index if not exists api_registro_token_idx on public.api_registro (token_id, creado_at desc);
create index if not exists api_registro_user_idx on public.api_registro (user_id, creado_at desc);
comment on table public.api_registro is
  'Registro de cada llamada a la API v1 (sin datos de facturas ni clientes). Sirve para el límite por token y auditoría.';

create table if not exists public.facturas_borrador_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.api_tokens(id) on delete set null,
  datos jsonb not null,
  base numeric(12, 2) not null,
  iva numeric(12, 2) not null,
  irpf numeric(12, 2) not null,
  total numeric(12, 2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'convertido', 'descartado')),
  invoice_id uuid references public.invoices(id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);
create index if not exists facturas_borrador_ia_user_idx on public.facturas_borrador_ia (user_id, estado, creado_at desc);
comment on table public.facturas_borrador_ia is
  'Borradores preparados por la IA (API v1 / MCP). No son facturas: el usuario los convierte en la app.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.api_tokens enable row level security;
alter table public.api_codigos_conexion enable row level security;
alter table public.api_registro enable row level security;
alter table public.facturas_borrador_ia enable row level security;

drop policy if exists "api_tokens select own" on public.api_tokens;
create policy "api_tokens select own" on public.api_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "api_registro select own" on public.api_registro;
create policy "api_registro select own" on public.api_registro
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "facturas_borrador_ia select own" on public.facturas_borrador_ia;
create policy "facturas_borrador_ia select own" on public.facturas_borrador_ia
  for select to authenticated using (user_id = auth.uid());

-- Los tokens, los códigos y el registro solo los escribe el servidor (service_role).
revoke all on table public.api_tokens, public.api_codigos_conexion, public.api_registro, public.facturas_borrador_ia
  from anon, authenticated;
grant select on table public.api_tokens, public.api_registro, public.facturas_borrador_ia to authenticated;
grant all on table public.api_tokens, public.api_codigos_conexion, public.api_registro, public.facturas_borrador_ia
  to service_role;

-- Revocar un token propio (Ajustes → Conexiones con IA). Irreversible: para volver, se conecta otra vez.
create or replace function public.api_token_revocar(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with r as (
    update public.api_tokens set revocado_at = now()
    where id = p_id and user_id = auth.uid() and revocado_at is null
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke all on function public.api_token_revocar(uuid) from public, anon;
grant execute on function public.api_token_revocar(uuid) to authenticated;

-- Descartar o marcar como convertido un borrador propio.
create or replace function public.borrador_ia_cerrar(p_id uuid, p_estado text, p_invoice uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  with r as (
    update public.facturas_borrador_ia
       set estado = p_estado, invoice_id = coalesce(p_invoice, invoice_id), actualizado_at = now()
     where id = p_id and user_id = auth.uid() and estado = 'pendiente'
       and p_estado in ('convertido', 'descartado')
       and (p_invoice is null or exists (select 1 from public.invoices i where i.id = p_invoice and i.user_id = auth.uid()))
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke all on function public.borrador_ia_cerrar(uuid, text, uuid) from public, anon;
grant execute on function public.borrador_ia_cerrar(uuid, text, uuid) to authenticated;

-- Limpieza: registro de más de 180 días y códigos caducados (se puede llamar desde un cron).
create or replace function public.api_limpieza()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.api_registro where creado_at < now() - interval '180 days';
  delete from public.api_codigos_conexion where caduca_at < now() - interval '1 day';
$$;
revoke all on function public.api_limpieza() from public, anon, authenticated;
grant execute on function public.api_limpieza() to service_role;
