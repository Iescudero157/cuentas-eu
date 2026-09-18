-- =============================================================================
-- V10 · Verifactu · worker de remisión (outbox → AEAT)
-- Base legal: art. 16.1 RRSIF (remisión continua) y art. 16 Orden HAC/1177/2024
-- (control de flujo TiempoEsperaEnvio, lotes ≤1000, reintentos al menos una vez
-- por hora, Incidencia=S para lo generado durante una caída). SPEC.md §5.3-§5.5.
--
-- Diseño: el cron de Vercel (app/api/cron/verifactu-remision) invoca al worker
-- TypeScript (lib/verifactu/remision.ts), que se apoya en estas funciones SQL
-- atómicas (security definer, SOLO service_role):
--   sif_remision_pendientes()   → obligados con trabajo listo (flujo + circuito)
--   sif_outbox_reclamar_lote()  → reclama ≤1000 registros (pendiente→en_envio)
--   sif_outbox_resolver_lote()  → aplica la respuesta AEAT (estados, CSV, flujo)
--   sif_outbox_fallar_lote()    → fallo del envío (backoff, incidencia, breaker)
--   sif_remision_estado()       → métricas del endpoint interno de estado
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Circuit breaker por obligado en sif_config (además del control de flujo
-- tiempo_espera_envio / proximo_envio_desde ya existente de V03).
-- -----------------------------------------------------------------------------
alter table public.sif_config
  add column if not exists fallos_consecutivos integer not null default 0,
  add column if not exists circuito_abierto_hasta timestamptz;

comment on column public.sif_config.fallos_consecutivos is
  'Envíos consecutivos fallidos del obligado (transporte/5xx/Fault). Se resetea con cada respuesta AEAT parseada.';
comment on column public.sif_config.circuito_abierto_hasta is
  'Circuit breaker: hasta este instante no se intentan envíos del obligado (compatible con el reintento >=1/hora del art. 16 Orden).';

-- -----------------------------------------------------------------------------
-- Backoff exponencial del reintento: 2,4,8,16,32,60 minutos (cap 60 min para
-- garantizar el «al menos una vez cada hora» del art. 16 Orden HAC/1177/2024).
-- p_intentos = intentos ya consumidos (>=1 tras el primer fallo).
-- -----------------------------------------------------------------------------
create or replace function public.sif_backoff_remision(p_intentos integer)
returns interval
language sql
immutable
as $$
  select least(power(2, greatest(least(coalesce(p_intentos, 1), 6), 1))::numeric, 60)
         * interval '1 minute'
$$;

-- Umbral y apertura del circuit breaker (constantes de diseño V10)
create or replace function public.sif_breaker_umbral() returns integer
language sql immutable as $$ select 5 $$;
create or replace function public.sif_breaker_apertura() returns interval
language sql immutable as $$ select interval '15 minutes' $$;

-- -----------------------------------------------------------------------------
-- sif_remision_pendientes: obligados con registros listos para remitir AHORA
-- (respetando activo/modalidad, control de flujo y circuit breaker). El worker
-- itera sobre esta lista. Incluye rescate de lotes zombis (en_envio >15 min sin
-- resolver: el worker murió entre el envío y la resolución; el reenvío es
-- idempotente gracias al tratamiento de duplicados de la AEAT, SPEC §5.4).
-- -----------------------------------------------------------------------------
create or replace function public.sif_remision_pendientes()
returns table (user_id uuid, pendientes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select o.user_id, count(*) as pendientes
    from public.sif_outbox o
    join public.sif_config c on c.user_id = o.user_id
   where c.activo
     and c.modalidad = 'verifactu'
     and (c.proximo_envio_desde is null or c.proximo_envio_desde <= now())
     and (c.circuito_abierto_hasta is null or c.circuito_abierto_hasta <= now())
     and (
       (o.estado = 'pendiente' and o.proximo_intento_at <= now())
       or (o.estado = 'en_envio' and o.ultimo_intento_at < now() - interval '15 minutes')
     )
   group by o.user_id
   order by min(o.created_at)
$$;

-- -----------------------------------------------------------------------------
-- sif_outbox_reclamar_lote: reclama atómicamente hasta p_max (≤1000, art. 16
-- Orden) registros del obligado. Aplica el control de flujo y el breaker (si no
-- toca enviar devuelve 0 filas), marca outbox pendiente→en_envio con un lote_id
-- nuevo e intentos+1, y sif_registros → 'sending'. FOR UPDATE SKIP LOCKED evita
-- que dos ejecuciones del cron reclamen las mismas filas.
-- -----------------------------------------------------------------------------
create or replace function public.sif_outbox_reclamar_lote(
  p_user_id uuid,
  p_max integer default 1000
)
returns table (
  outbox_id uuid,
  lote_id uuid,
  registro_id uuid,
  tipo_registro text,
  num_serie_factura text,
  fecha_expedicion date,
  intentos integer,
  incidencia boolean,
  xml text,
  registro jsonb,
  huella text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.sif_config%rowtype;
  v_lote uuid := gen_random_uuid();
begin
  -- Solo el backend (service_role, sin JWT de usuario)
  if auth.uid() is not null then
    raise exception 'SIF_SOLO_SERVICIO: la remisión la ejecuta el worker con service_role';
  end if;
  if p_max is null or p_max < 1 or p_max > 1000 then
    raise exception 'SIF_LOTE: el lote debe ser de 1 a 1000 registros (art. 16 Orden HAC/1177/2024)';
  end if;

  select * into v_config from public.sif_config c where c.user_id = p_user_id for update;
  if not found then
    raise exception 'SIF_NO_CONFIGURADO: el obligado no tiene configuración Verifactu';
  end if;
  if not v_config.activo or v_config.modalidad <> 'verifactu' then
    return; -- nada que remitir para obligados inactivos o no VERI*FACTU (V14)
  end if;
  -- Control de flujo (art. 16 Orden): obedecer el último TiempoEsperaEnvio
  if v_config.proximo_envio_desde is not null and v_config.proximo_envio_desde > now() then
    return;
  end if;
  -- Circuit breaker abierto: no martillear a la AEAT
  if v_config.circuito_abierto_hasta is not null and v_config.circuito_abierto_hasta > now() then
    return;
  end if;

  return query
  with candidatos as (
    select o.id as o_id
      from public.sif_outbox o
     where o.user_id = p_user_id
       and (
         (o.estado = 'pendiente' and o.proximo_intento_at <= now())
         or (o.estado = 'en_envio' and o.ultimo_intento_at < now() - interval '15 minutes')
       )
     order by o.created_at
     limit p_max
       for update of o skip locked
  ),
  outbox_upd as (
    update public.sif_outbox o
       set estado = 'en_envio',
           lote_id = v_lote,
           intentos = o.intentos + 1,
           ultimo_intento_at = now()
      from candidatos c
     where o.id = c.o_id
    returning o.id as o_id, o.registro_id as r_id, o.intentos as o_intentos,
              o.incidencia as o_incidencia
  ),
  reg_upd as (
    update public.sif_registros r
       set estado_remision = 'sending'
      from outbox_upd u
     where r.id = u.r_id
       and r.estado_remision in ('generated', 'queued', 'sending')
    returning r.id
  )
  select u.o_id, v_lote, u.r_id, r.tipo_registro, r.num_serie_factura,
         r.fecha_expedicion, u.o_intentos, u.o_incidencia, r.xml, r.registro, r.huella
    from outbox_upd u
    join public.sif_registros r on r.id = u.r_id
   order by r.correlativo;
end;
$$;

-- -----------------------------------------------------------------------------
-- sif_outbox_resolver_lote: aplica la respuesta de la AEAT a un lote enviado.
-- p_lineas: array jsonb [{registro_id, estado, codigo_error, descripcion,
-- respuesta}] con estado interno 'accepted' | 'accepted_with_errors' |
-- 'rejected' (SPEC §5.5, mapeado en TS con estadoInternoLinea/estadoSiDuplicado).
-- Actualiza sif_registros (bloque de remisión), sif_outbox (enviado/error) y el
-- control de flujo de sif_config con el TiempoEsperaEnvio recibido; resetea el
-- circuit breaker (hubo respuesta válida de la AEAT). Filas del lote sin línea
-- de respuesta vuelven a 'pendiente' con backoff (no debería ocurrir).
-- Devuelve el nº de registros resueltos.
-- -----------------------------------------------------------------------------
create or replace function public.sif_outbox_resolver_lote(
  p_user_id uuid,
  p_lote_id uuid,
  p_estado_envio text,
  p_csv text,
  p_tiempo_espera integer,
  p_lineas jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linea jsonb;
  v_registro_id uuid;
  v_estado text;
  v_resueltos integer := 0;
  v_espera integer := greatest(coalesce(p_tiempo_espera, 60), 1);
begin
  if auth.uid() is not null then
    raise exception 'SIF_SOLO_SERVICIO: la remisión la ejecuta el worker con service_role';
  end if;
  if p_estado_envio not in ('Correcto', 'ParcialmenteCorrecto', 'Incorrecto') then
    raise exception 'SIF_ESTADO_ENVIO: EstadoEnvio inválido "%"', p_estado_envio;
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'SIF_LINEAS: p_lineas debe ser un array jsonb';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    v_registro_id := (v_linea ->> 'registro_id')::uuid;
    v_estado := v_linea ->> 'estado';
    if v_estado not in ('accepted', 'accepted_with_errors', 'rejected') then
      raise exception 'SIF_LINEA_ESTADO: estado interno inválido "%" (registro %)', v_estado, v_registro_id;
    end if;

    -- El registro debe pertenecer al lote y al obligado (integridad del cierre)
    if not exists (
      select 1 from public.sif_outbox o
       where o.registro_id = v_registro_id and o.user_id = p_user_id
         and o.lote_id = p_lote_id and o.estado = 'en_envio'
    ) then
      raise exception 'SIF_LOTE_LINEA: el registro % no está en_envio en el lote %', v_registro_id, p_lote_id;
    end if;

    update public.sif_registros r
       set estado_remision = v_estado,
           csv_aeat = case when v_estado in ('accepted', 'accepted_with_errors') then p_csv else r.csv_aeat end,
           respuesta_aeat = v_linea -> 'respuesta',
           codigo_error_registro = v_linea ->> 'codigo_error',
           descripcion_error = v_linea ->> 'descripcion',
           -- Constancia de si este registro se remitió marcado Incidencia=S
           incidencia = o.incidencia,
           remitido_at = now()
      from public.sif_outbox o
     where r.id = v_registro_id and r.user_id = p_user_id
       and o.registro_id = r.id and o.user_id = p_user_id;

    update public.sif_outbox o
       set estado = case when v_estado = 'rejected' then 'error' else 'enviado' end,
           ultimo_error = case when v_estado = 'rejected'
                               then coalesce(v_linea ->> 'descripcion', 'Registro rechazado por la AEAT')
                               else null end
     where o.registro_id = v_registro_id and o.user_id = p_user_id and o.lote_id = p_lote_id;

    v_resueltos := v_resueltos + 1;
  end loop;

  -- Filas del lote sin línea de respuesta: reintento con backoff e incidencia
  update public.sif_outbox o
     set estado = 'pendiente',
         incidencia = true,
         ultimo_error = 'Sin RespuestaLinea de la AEAT para este registro en el lote',
         proximo_intento_at = now() + public.sif_backoff_remision(o.intentos)
   where o.user_id = p_user_id and o.lote_id = p_lote_id and o.estado = 'en_envio';
  update public.sif_registros r
     set estado_remision = 'queued'
    from public.sif_outbox o
   where o.registro_id = r.id and o.user_id = p_user_id
     and o.lote_id = p_lote_id and o.estado = 'pendiente'
     and r.estado_remision = 'sending';

  -- Control de flujo (art. 16 Orden): obedecer el ÚLTIMO TiempoEsperaEnvio y
  -- resetear el breaker: la AEAT respondió.
  update public.sif_config c
     set tiempo_espera_envio = v_espera,
         proximo_envio_desde = now() + v_espera * interval '1 second',
         fallos_consecutivos = 0,
         circuito_abierto_hasta = null
   where c.user_id = p_user_id;

  return v_resueltos;
end;
$$;

-- -----------------------------------------------------------------------------
-- sif_outbox_fallar_lote: el envío del lote NO obtuvo respuesta AEAT parseable
-- (caída de red, timeout, 5xx, SOAP Fault…). Las filas vuelven a 'pendiente'
-- con backoff exponencial (cap 60 min: reintento >=1/hora del art. 16 Orden),
-- se marcan con incidencia=true (los reenvíos irán con Incidencia=S) y los
-- registros regresan a 'queued'. Incrementa el circuit breaker: al alcanzar el
-- umbral, el circuito del obligado se abre 15 minutos. p_reintentable=false
-- (p.ej. SOAP Fault estructural) fuerza directamente el backoff máximo (60 min).
-- Devuelve el nº de filas devueltas a la cola.
-- -----------------------------------------------------------------------------
create or replace function public.sif_outbox_fallar_lote(
  p_user_id uuid,
  p_lote_id uuid,
  p_error text,
  p_reintentable boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer;
  v_fallos integer;
begin
  if auth.uid() is not null then
    raise exception 'SIF_SOLO_SERVICIO: la remisión la ejecuta el worker con service_role';
  end if;

  update public.sif_outbox o
     set estado = 'pendiente',
         incidencia = true,
         ultimo_error = coalesce(nullif(btrim(p_error), ''), 'Fallo de remisión sin detalle'),
         proximo_intento_at = now() + case
           when p_reintentable then public.sif_backoff_remision(o.intentos)
           else interval '60 minutes'
         end
   where o.user_id = p_user_id and o.lote_id = p_lote_id and o.estado = 'en_envio';
  get diagnostics v_filas = row_count;

  if v_filas = 0 then
    return 0; -- lote ya resuelto o inexistente: no tocar el breaker
  end if;

  update public.sif_registros r
     set estado_remision = 'queued'
    from public.sif_outbox o
   where o.registro_id = r.id and o.user_id = p_user_id and o.lote_id = p_lote_id
     and r.estado_remision = 'sending';

  update public.sif_config c
     set fallos_consecutivos = c.fallos_consecutivos + 1
   where c.user_id = p_user_id
  returning c.fallos_consecutivos into v_fallos;

  if v_fallos >= public.sif_breaker_umbral() then
    update public.sif_config c
       set circuito_abierto_hasta = now() + public.sif_breaker_apertura()
     where c.user_id = p_user_id;
  end if;

  return v_filas;
end;
$$;

-- -----------------------------------------------------------------------------
-- sif_remision_estado: métricas agregadas de la cola para el endpoint interno
-- de estado (app/api/verifactu/estado-remision, protegido con CRON_SECRET).
-- -----------------------------------------------------------------------------
create or replace function public.sif_remision_estado()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'outbox', coalesce((
      select jsonb_object_agg(t.estado, t.n)
        from (select o.estado, count(*) as n from public.sif_outbox o group by o.estado) t
    ), '{}'::jsonb),
    'registros', coalesce((
      select jsonb_object_agg(t.estado_remision, t.n)
        from (select r.estado_remision, count(*) as n from public.sif_registros r group by r.estado_remision) t
    ), '{}'::jsonb),
    'pendiente_mas_antiguo', (
      select min(o.created_at) from public.sif_outbox o where o.estado = 'pendiente'
    ),
    'obligados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', c.user_id,
               'activo', c.activo,
               'entorno_aeat', c.entorno_aeat,
               'tiempo_espera_envio', c.tiempo_espera_envio,
               'proximo_envio_desde', c.proximo_envio_desde,
               'fallos_consecutivos', c.fallos_consecutivos,
               'circuito_abierto_hasta', c.circuito_abierto_hasta,
               'pendientes', coalesce(p.n, 0)
             ) order by coalesce(p.n, 0) desc)
        from public.sif_config c
        left join (
          select o.user_id, count(*) as n
            from public.sif_outbox o
           where o.estado in ('pendiente', 'en_envio')
           group by o.user_id
        ) p on p.user_id = c.user_id
    ), '[]'::jsonb)
  )
$$;

-- -----------------------------------------------------------------------------
-- Permisos: SOLO service_role (el worker). Ni anon ni authenticated.
-- -----------------------------------------------------------------------------
revoke all on function public.sif_backoff_remision(integer) from public, anon, authenticated;
revoke all on function public.sif_breaker_umbral() from public, anon, authenticated;
revoke all on function public.sif_breaker_apertura() from public, anon, authenticated;
revoke all on function public.sif_remision_pendientes() from public, anon, authenticated;
revoke all on function public.sif_outbox_reclamar_lote(uuid, integer) from public, anon, authenticated;
revoke all on function public.sif_outbox_resolver_lote(uuid, uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.sif_outbox_fallar_lote(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.sif_remision_estado() from public, anon, authenticated;

grant execute on function public.sif_backoff_remision(integer) to service_role;
grant execute on function public.sif_breaker_umbral() to service_role;
grant execute on function public.sif_breaker_apertura() to service_role;
grant execute on function public.sif_remision_pendientes() to service_role;
grant execute on function public.sif_outbox_reclamar_lote(uuid, integer) to service_role;
grant execute on function public.sif_outbox_resolver_lote(uuid, uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.sif_outbox_fallar_lote(uuid, uuid, text, boolean) to service_role;
grant execute on function public.sif_remision_estado() to service_role;
