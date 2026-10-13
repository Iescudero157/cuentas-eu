-- =============================================================================
-- Productor del SIF: Mercadonet Global S.L. -> Milbrotes S.L. (traspaso oct-2026)
--
-- sif_registrar_evento() llevaba el NIF del productor fijado en el SQL
-- ('NIF=B98407901', migración 20260919100000_sif_incidencias.sql). Con el
-- cambio de productor ese literal dejaría la cadena de eventos con el NIF de
-- Mercadonet mientras los registros llevan el de Milbrotes. Desde ahora el NIF
-- del productor lo pasa el servidor desde la fuente única PRODUCTOR_SIF
-- (lib/verifactu/productor-sif.ts) y la función ABORTA si llega vacío o con
-- marcador: nunca se anota un evento con el NIF del productor vacío.
--
-- Mercadonet Global S.L. (B98407901) sigue siendo cliente/obligado: no se toca
-- ningún dato de sif_config ni de registros ya generados.
--
-- NOTA: NO aplicar contra producción desde el repo. Aplicar el día D, cuando
-- PRODUCTOR_SIF.nif tenga el NIF de Milbrotes y se despliegue el código que
-- pasa p_productor_nif (integridad.ts, api/verifactu/export, verifactu-exportar).
-- =============================================================================

drop function if exists public.sif_registrar_evento(uuid, text, jsonb);

create or replace function public.sif_registrar_evento(
  p_user_id uuid,
  p_tipo_evento text,
  p_productor_nif text,
  p_datos jsonb default '{}'::jsonb
)
returns table (
  evento_id uuid,
  correlativo bigint,
  huella text,
  huella_anterior text,
  fecha_hora_huso_gen text,
  primer_evento boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config      public.sif_config%rowtype;
  v_tipo_oficial text;
  v_prev        public.sif_eventos%rowtype;
  v_correlativo bigint;
  v_huella_ant  text;
  v_fh          text;
  v_cadena      text;
  v_huella      text;
  v_nif_prod    text := upper(btrim(coalesce(p_productor_nif, '')));
  v_id          uuid := gen_random_uuid();
begin
  if auth.uid() is not null then
    raise exception 'SIF_SOLO_SERVICIO: los eventos los registra el servidor (service_role)';
  end if;

  if v_nif_prod !~ '^[A-Z0-9]{9}$' then
    raise exception 'SIF_PRODUCTOR_SIN_NIF: el NIF del productor del SIF está vacío o no es válido («%»); rellenar PRODUCTOR_SIF en lib/verifactu/productor-sif.ts', v_nif_prod;
  end if;

  v_tipo_oficial := public.sif_evento_tipo_oficial(p_tipo_evento);
  if v_tipo_oficial is null then
    raise exception 'SIF_TIPO_EVENTO: tipo de evento «%» desconocido', p_tipo_evento;
  end if;

  select * into v_config from public.sif_config c where c.user_id = p_user_id;
  if not found then
    raise exception 'SIF_NO_CONFIGURADO: el obligado no tiene configuración Verifactu';
  end if;

  -- Serializa la cadena de eventos del obligado (cadena PROPIA, art. 9 Orden)
  perform pg_advisory_xact_lock(hashtext('sif_eventos:' || p_user_id::text));

  select * into v_prev
    from public.sif_eventos e
   where e.user_id = p_user_id
   order by e.correlativo desc
   limit 1;

  v_correlativo := coalesce(v_prev.correlativo, 0) + 1;
  v_huella_ant := v_prev.huella;  -- null si es el primer evento
  v_fh := public.sif_fecha_hora_huso(now());

  -- Cadena de entrada oficial del evento (doc. huella §3.c, 9 pares; mismos
  -- valores que cadenaEntradaEvento() de lib/verifactu/huella.ts)
  v_cadena :=
       'NIF=' || v_nif_prod
    || '&ID='
    || '&IdSistemaInformatico=01'
    || '&Version=1.0.0'
    || '&NumeroInstalacion=' || v_config.numero_instalacion
    || '&NIF=' || v_config.nif_obligado
    || '&TipoEvento=' || v_tipo_oficial
    || '&HuellaEvento=' || coalesce(v_huella_ant, '')
    || '&FechaHoraHusoGenEvento=' || v_fh;
  v_huella := public.sif_sha256(v_cadena);

  insert into public.sif_eventos (
    id, user_id, correlativo, tipo_evento, datos,
    primer_evento, huella_anterior, huella, fecha_hora_huso_gen)
  values (
    v_id, p_user_id, v_correlativo, p_tipo_evento,
    coalesce(p_datos, '{}'::jsonb)
      || jsonb_build_object('tipoEventoOficial', v_tipo_oficial, 'nifProductor', v_nif_prod),
    v_huella_ant is null, v_huella_ant, v_huella, v_fh);

  return query select v_id, v_correlativo, v_huella, v_huella_ant, v_fh, (v_huella_ant is null);
end;
$$;

revoke all on function public.sif_registrar_evento(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.sif_registrar_evento(uuid, text, text, jsonb) to service_role;
