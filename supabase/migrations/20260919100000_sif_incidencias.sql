-- =============================================================================
-- V12 · Verifactu · incidencias e integridad
-- Base legal: doc. AEAT «Validaciones y errores» (Subsanacion/RechazoPrevio),
-- SPEC.md §5.4-§5.5 (AceptadoConErrores → subsanación; Incorrecto → corregir y
-- reenviar con RechazoPrevio=S); arts. 8.2 y 12 RD 1007/2023 (integridad e
-- inalterabilidad, huella encadenada); art. 7 Orden HAC/1177/2024 (cadena);
-- art. 9 Orden (eventos — EXENTO en VERI*FACTU por art. 3; registro interno
-- como producto total, XML firmado en V14).
--
-- Contenido:
--   1. Estados terminales 'subsanado' (accepted_with_errors→) y 'resent'
--      (rejected→) en sif_registros.estado_remision (SPEC §5.5) + columna
--      subsana_registro_id (enlace del registro subsanador con el subsanado).
--   2. sif_subsanar_registro(): NUEVO registro de alta con Subsanacion=S (o
--      reenvío de anulación con RechazoPrevio=S) en la MISMA cadena y con el
--      MISMO IDFactura, transaccional como la emisión (V07).
--   3. sif_detectar_anomalias(): detección en SQL de huecos de correlativo,
--      roturas de encadenamiento, huellas que no cuadran (recalculadas con la
--      misma fórmula oficial que la emisión), jsonb inconsistente, fechas no
--      trazables y desincronización del puntero sif_cadena.
--   4. sif_registrar_evento(): anota eventos de incidencia en sif_eventos con
--      su cadena de huellas PROPIA (fórmula oficial del doc. de huella §3.c).
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. Estados terminales de la máquina de estados (SPEC §5.5):
--     accepted_with_errors → subsanado · rejected → resent
-- -----------------------------------------------------------------------------
alter table public.sif_registros
  drop constraint if exists sif_registros_estado_remision_check;
alter table public.sif_registros
  drop constraint if exists sif_registros_estado_remision_chk;
alter table public.sif_registros
  add constraint sif_registros_estado_remision_chk check (estado_remision in (
    'generated','queued','sending','accepted','accepted_with_errors','rejected',
    'subsanado','resent'
  ));

-- 1b. Enlace subsanador → subsanado (parte del contenido inmutable del registro)
alter table public.sif_registros
  add column if not exists subsana_registro_id uuid references public.sif_registros(id) on delete restrict;

comment on column public.sif_registros.subsana_registro_id is
  'Registro previo al que este subsana (Subsanacion=S) o reenvía tras rechazo (RechazoPrevio=S). NULL si no es subsanación.';

create index if not exists sif_registros_subsana_idx
  on public.sif_registros (subsana_registro_id) where subsana_registro_id is not null;

-- El guard de inmutabilidad (V03) se recrea añadiendo la columna nueva a la
-- lista de contenido congelado; solo el bloque de remisión sigue siendo mutable.
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
     or new.subsana_registro_id is distinct from old.subsana_registro_id
     or new.created_at <> old.created_at
  then
    raise exception 'sif_registros es inmutable: solo puede evolucionar el estado de remisión (art. 8.2 RD 1007/2023; art. 6 Orden HAC/1177/2024)';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. sif_subsanar_registro: subsanación/reenvío atómico (misma transacción que
--    la emisión V07: lock de cadena + huella + registro append-only + outbox).
--    · alta 'accepted_with_errors' → nuevo alta Subsanacion=S (el previo pasa a
--      'subsanado'); la AEAT ya lo tiene registrado y admite la corrección.
--    · alta 'rejected'             → nuevo alta Subsanacion=S + RechazoPrevio=S
--      (el previo pasa a 'resent'); el registro previo NO consta en la AEAT.
--    · anulación 'rejected'        → nueva anulación RechazoPrevio=S (el previo
--      pasa a 'resent'). Una anulación registrada no se subsana (sin campo
--      Subsanacion en el XSD).
--    El IDFactura (NIF, NumSerieFactura, FechaExpedicion) NO cambia: se corrige
--    el registro, no la factura (una factura errónea se rectifica R1-R5 o se
--    anula, V07). El servidor Next valida la entrada con construirRegistroAlta/
--    construirRegistroAnulacion ANTES de llamar (dry-run, como en la emisión).
-- -----------------------------------------------------------------------------
create or replace function public.sif_subsanar_registro(
  p_user_id uuid,
  p_registro_prev_id uuid,
  p_registro jsonb,
  p_cuota_total numeric default null,
  p_importe_total numeric default null
)
returns table (
  registro_id uuid,
  correlativo bigint,
  num_serie_factura text,
  huella text,
  huella_anterior text,
  fecha_hora_huso_gen text,
  tipo_registro text,
  estado_previo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config        public.sif_config%rowtype;
  v_prev          public.sif_registros%rowtype;
  v_cadena        public.sif_cadena%rowtype;
  v_tipo_factura  text;
  v_rechazo       text;
  v_subsanacion   text;
  v_fh            text;
  v_huella_ant    text;
  v_correlativo   bigint;
  v_cadena_entrada text;
  v_huella        text;
  v_encadenamiento jsonb;
  v_registro      jsonb;
  v_estado_nuevo_prev text;
  v_registro_id   uuid := gen_random_uuid();
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'SIF_USUARIO: user_id no coincide con el usuario autenticado';
  end if;

  select * into v_config from public.sif_config c where c.user_id = p_user_id;
  if not found then
    raise exception 'SIF_NO_CONFIGURADO: el obligado no tiene configuración Verifactu';
  end if;
  if not v_config.activo then
    raise exception 'SIF_INACTIVO: el módulo Verifactu no está activado para este obligado';
  end if;
  if v_config.modalidad <> 'verifactu' then
    raise exception 'SIF_MODALIDAD: la modalidad % no está soportada en v1 (V14)', v_config.modalidad;
  end if;

  -- Serializar por obligado ANTES de leer el registro previo: el lock de la
  -- cadena evita dos subsanaciones concurrentes del mismo registro (D-05).
  select * into v_cadena from public.sif_cadena c where c.user_id = p_user_id for update;
  if not found then
    raise exception 'SIF_CADENA: el obligado no tiene cadena iniciada';
  end if;

  select * into v_prev
    from public.sif_registros r
   where r.id = p_registro_prev_id and r.user_id = p_user_id;
  if not found then
    raise exception 'SIF_REGISTRO: registro % no encontrado para el usuario', p_registro_prev_id;
  end if;

  if v_prev.tipo_registro = 'alta' then
    if v_prev.estado_remision not in ('accepted_with_errors', 'rejected') then
      raise exception 'SIF_NO_SUBSANABLE: el registro está "%" (solo se subsana accepted_with_errors o se reenvía rejected)', v_prev.estado_remision;
    end if;

    v_subsanacion := upper(coalesce(p_registro #>> '{entrada,subsanacion}', ''));
    v_rechazo := upper(coalesce(p_registro #>> '{entrada,rechazoPrevio}', ''));
    if v_subsanacion <> 'S' then
      raise exception 'SIF_SUBSANACION: la entrada debe llevar subsanacion=S (doc. validaciones AEAT)';
    end if;
    if v_prev.estado_remision = 'rejected' and v_rechazo <> 'S' then
      raise exception 'SIF_RECHAZO_PREVIO: el registro previo fue rechazado; la entrada debe llevar rechazoPrevio=S';
    end if;
    if v_prev.estado_remision = 'accepted_with_errors' and v_rechazo not in ('', 'N') then
      raise exception 'SIF_RECHAZO_PREVIO: el registro previo NO fue rechazado (aceptado con errores); rechazoPrevio debe omitirse o ser N';
    end if;

    -- El IDFactura no cambia: mismo NIF, número+serie y fecha de expedición
    if (p_registro #>> '{entrada,emisor,nif}') is distinct from v_config.nif_obligado then
      raise exception 'SIF_EMISOR: el NIF emisor del registro no coincide con sif_config.nif_obligado';
    end if;
    if (p_registro #>> '{entrada,numSerieFactura}') is distinct from v_prev.num_serie_factura then
      raise exception 'SIF_IDFACTURA: numSerieFactura debe ser el del registro subsanado («%»)', v_prev.num_serie_factura;
    end if;
    if (p_registro #>> '{entrada,fechaExpedicion}')::date is distinct from v_prev.fecha_expedicion then
      raise exception 'SIF_IDFACTURA: fechaExpedicion debe ser la del registro subsanado (%)', v_prev.fecha_expedicion;
    end if;

    v_tipo_factura := upper(coalesce(p_registro #>> '{entrada,tipoFactura}', ''));
    if v_tipo_factura not in ('F1','F2','F3','R1','R2','R3','R4','R5') then
      raise exception 'SIF_TIPO_FACTURA: TipoFactura inválido: "%"', v_tipo_factura;
    end if;
    if p_cuota_total is null or p_importe_total is null then
      raise exception 'SIF_IMPORTES: cuota_total e importe_total son obligatorios en la subsanación de un alta';
    end if;

    v_estado_nuevo_prev := case when v_prev.estado_remision = 'rejected' then 'resent' else 'subsanado' end;
  elsif v_prev.tipo_registro = 'anulacion' then
    if v_prev.estado_remision <> 'rejected' then
      raise exception 'SIF_NO_SUBSANABLE: una anulación solo se reenvía si fue rechazada (estado actual: "%")', v_prev.estado_remision;
    end if;
    if upper(coalesce(p_registro #>> '{entrada,rechazoPrevio}', '')) <> 'S' then
      raise exception 'SIF_RECHAZO_PREVIO: el reenvío de una anulación rechazada debe llevar rechazoPrevio=S';
    end if;
    if (p_registro #>> '{entrada,emisor,nif}') is distinct from v_config.nif_obligado then
      raise exception 'SIF_EMISOR: el NIF emisor del registro no coincide con sif_config.nif_obligado';
    end if;
    if (p_registro #>> '{entrada,numSerieFacturaAnulada}') is distinct from v_prev.num_serie_factura then
      raise exception 'SIF_IDFACTURA: numSerieFacturaAnulada debe ser la del registro rechazado («%»)', v_prev.num_serie_factura;
    end if;
    if (p_registro #>> '{entrada,fechaExpedicionFacturaAnulada}')::date is distinct from v_prev.fecha_expedicion then
      raise exception 'SIF_IDFACTURA: fechaExpedicionFacturaAnulada debe ser la del registro rechazado (%)', v_prev.fecha_expedicion;
    end if;
    v_estado_nuevo_prev := 'resent';
  else
    raise exception 'SIF_TIPO_REGISTRO: tipo de registro «%» no subsanable', v_prev.tipo_registro;
  end if;

  -- Huella encadenada (art. 12 RRSIF; §4 SPEC — misma fórmula que la emisión)
  v_fh := public.sif_fecha_hora_huso(now());
  v_huella_ant := case when v_cadena.correlativo_ultimo = 0 then null else v_cadena.ultima_huella end;
  v_correlativo := v_cadena.correlativo_ultimo + 1;

  if v_prev.tipo_registro = 'alta' then
    v_cadena_entrada :=
         'IDEmisorFactura=' || v_config.nif_obligado
      || '&NumSerieFactura=' || v_prev.num_serie_factura
      || '&FechaExpedicionFactura=' || to_char(v_prev.fecha_expedicion, 'DD-MM-YYYY')
      || '&TipoFactura=' || v_tipo_factura
      || '&CuotaTotal=' || public.sif_formatear_importe(p_cuota_total)
      || '&ImporteTotal=' || public.sif_formatear_importe(p_importe_total)
      || '&Huella=' || coalesce(v_huella_ant, '')
      || '&FechaHoraHusoGenRegistro=' || v_fh;
  else
    v_cadena_entrada :=
         'IDEmisorFacturaAnulada=' || v_config.nif_obligado
      || '&NumSerieFacturaAnulada=' || v_prev.num_serie_factura
      || '&FechaExpedicionFacturaAnulada=' || to_char(v_prev.fecha_expedicion, 'DD-MM-YYYY')
      || '&Huella=' || coalesce(v_huella_ant, '')
      || '&FechaHoraHusoGenRegistro=' || v_fh;
  end if;
  v_huella := public.sif_sha256(v_cadena_entrada);

  if v_huella_ant is null then
    v_encadenamiento := jsonb_build_object('primerRegistro', true);
  else
    v_encadenamiento := jsonb_build_object('registroAnterior', jsonb_build_object(
      'idEmisorFactura', v_cadena.nif_obligado,
      'numSerieFactura', v_cadena.ultimo_num_serie_factura,
      'fechaExpedicion', to_char(v_cadena.ultima_fecha_expedicion, 'DD-MM-YYYY'),
      'huella', v_huella_ant));
  end if;

  v_registro := jsonb_set(p_registro, '{encadenamiento}', v_encadenamiento);
  v_registro := jsonb_set(v_registro, '{fechaHoraHusoGenRegistro}', to_jsonb(v_fh));
  v_registro := jsonb_set(v_registro, '{tipoHuella}', to_jsonb('01'::text));
  v_registro := jsonb_set(v_registro, '{huella}', to_jsonb(v_huella));

  insert into public.sif_registros (
    id, user_id, correlativo, tipo_registro, invoice_id,
    id_emisor_factura, num_serie_factura, fecha_expedicion,
    tipo_factura, cuota_total, importe_total, registro,
    primer_registro, huella_anterior, huella, fecha_hora_huso_gen,
    subsanacion, rechazo_previo, subsana_registro_id)
  values (
    v_registro_id, p_user_id, v_correlativo, v_prev.tipo_registro, v_prev.invoice_id,
    v_config.nif_obligado, v_prev.num_serie_factura, v_prev.fecha_expedicion,
    case when v_prev.tipo_registro = 'alta' then v_tipo_factura end,
    case when v_prev.tipo_registro = 'alta' then round(p_cuota_total, 2) end,
    case when v_prev.tipo_registro = 'alta' then round(p_importe_total, 2) end,
    v_registro,
    v_huella_ant is null, v_huella_ant, v_huella, v_fh,
    v_prev.tipo_registro = 'alta',
    case when upper(coalesce(p_registro #>> '{entrada,rechazoPrevio}', '')) in ('S','N','X')
         then upper(p_registro #>> '{entrada,rechazoPrevio}') end,
    v_prev.id);

  -- Outbox en la misma transacción (patrón outbox, D-04)
  insert into public.sif_outbox (user_id, registro_id) values (p_user_id, v_registro_id);

  update public.sif_cadena set
    correlativo_ultimo = v_correlativo,
    ultimo_registro_id = v_registro_id,
    ultima_huella = v_huella,
    ultimo_num_serie_factura = v_prev.num_serie_factura,
    ultima_fecha_expedicion = v_prev.fecha_expedicion,
    updated_at = now()
  where user_id = p_user_id;

  -- El registro previo pasa a su estado terminal (SPEC §5.5); su contenido
  -- oficial no se toca (solo evoluciona el bloque de remisión).
  update public.sif_registros r
     set estado_remision = v_estado_nuevo_prev
   where r.id = v_prev.id;

  return query select v_registro_id, v_correlativo, v_prev.num_serie_factura,
    v_huella, v_huella_ant, v_fh, v_prev.tipo_registro, v_prev.estado_remision;
end;
$$;

revoke all on function public.sif_subsanar_registro(uuid, uuid, jsonb, numeric, numeric) from public;
revoke all on function public.sif_subsanar_registro(uuid, uuid, jsonb, numeric, numeric) from anon;
grant execute on function public.sif_subsanar_registro(uuid, uuid, jsonb, numeric, numeric)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. sif_detectar_anomalias: detección de huecos y roturas de cadena en SQL
--    (arts. 8.2 y 12 RRSIF). Recalcula cada huella con la MISMA fórmula oficial
--    de la emisión (sif_sha256 + sif_formatear_importe) y la compara con la
--    almacenada. Devuelve TODAS las anomalías (no se detiene en la primera).
--    Códigos: HUECO_CORRELATIVO · ENCADENADO_ROTO · PRIMER_REGISTRO_INCOHERENTE
--             · HUELLA_NO_COINCIDE · JSONB_INCONSISTENTE · FECHA_RETROCEDIDA
--             · FECHA_FUTURA · CADENA_DESINCRONIZADA
-- -----------------------------------------------------------------------------
create or replace function public.sif_detectar_anomalias(p_user_id uuid default null)
returns table (
  user_id uuid,
  registro_id uuid,
  correlativo bigint,
  codigo text,
  detalle text
)
language sql
security definer
set search_path = public
stable
as $$
  with regs as (
    select r.*,
           lag(r.correlativo) over w as prev_corr,
           lag(r.huella) over w as prev_huella,
           lag(r.fecha_hora_huso_gen) over w as prev_fh,
           row_number() over w as rn
      from public.sif_registros r
     where p_user_id is null or r.user_id = p_user_id
    window w as (partition by r.user_id order by r.correlativo)
  ),
  recalculadas as (
    select regs.*, public.sif_sha256(
      case when regs.tipo_registro = 'alta' then
           'IDEmisorFactura=' || regs.id_emisor_factura
        || '&NumSerieFactura=' || regs.num_serie_factura
        || '&FechaExpedicionFactura=' || to_char(regs.fecha_expedicion, 'DD-MM-YYYY')
        || '&TipoFactura=' || coalesce(regs.tipo_factura, '')
        || '&CuotaTotal=' || public.sif_formatear_importe(coalesce(regs.cuota_total, 0))
        || '&ImporteTotal=' || public.sif_formatear_importe(coalesce(regs.importe_total, 0))
        || '&Huella=' || coalesce(regs.huella_anterior, '')
        || '&FechaHoraHusoGenRegistro=' || regs.fecha_hora_huso_gen
      else
           'IDEmisorFacturaAnulada=' || regs.id_emisor_factura
        || '&NumSerieFacturaAnulada=' || regs.num_serie_factura
        || '&FechaExpedicionFacturaAnulada=' || to_char(regs.fecha_expedicion, 'DD-MM-YYYY')
        || '&Huella=' || coalesce(regs.huella_anterior, '')
        || '&FechaHoraHusoGenRegistro=' || regs.fecha_hora_huso_gen
      end) as huella_recalculada
      from regs
  )
  select r.user_id, r.id, r.correlativo, 'HUECO_CORRELATIVO',
         format('Faltan los correlativos %s a %s (registros no anotados o eliminados)',
                coalesce(r.prev_corr, 0) + 1, r.correlativo - 1)
    from recalculadas r
   where (r.rn = 1 and r.correlativo <> 1)
      or (r.prev_corr is not null and r.correlativo <> r.prev_corr + 1)
  union all
  select r.user_id, r.id, r.correlativo, 'ENCADENADO_ROTO',
         format('huella_anterior «%s» no coincide con la huella del registro %s «%s»',
                coalesce(r.huella_anterior, ''), r.prev_corr, coalesce(r.prev_huella, ''))
    from recalculadas r
   where r.prev_corr is not null and r.correlativo = r.prev_corr + 1
     and coalesce(r.huella_anterior, '') <> coalesce(r.prev_huella, '')
  union all
  select r.user_id, r.id, r.correlativo, 'PRIMER_REGISTRO_INCOHERENTE',
         case when r.rn = 1 then 'El primer registro de la cadena no está marcado primer_registro'
              else 'Registro marcado primer_registro en mitad de la cadena' end
    from recalculadas r
   where (r.rn = 1 and r.correlativo = 1 and not r.primer_registro)
      or (r.rn > 1 and r.primer_registro)
  union all
  select r.user_id, r.id, r.correlativo, 'HUELLA_NO_COINCIDE',
         format('Huella recalculada «%s» ≠ huella almacenada «%s»', r.huella_recalculada, r.huella)
    from recalculadas r
   where r.huella_recalculada <> r.huella
  union all
  select r.user_id, r.id, r.correlativo, 'JSONB_INCONSISTENTE',
         'El contenido oficial (jsonb) no coincide con las columnas del registro (huella o FechaHoraHusoGenRegistro)'
    from recalculadas r
   where (r.registro ->> 'huella') is distinct from r.huella
      or (r.registro ->> 'fechaHoraHusoGenRegistro') is distinct from r.fecha_hora_huso_gen
  union all
  select r.user_id, r.id, r.correlativo, 'FECHA_RETROCEDIDA',
         format('FechaHoraHusoGenRegistro «%s» anterior a la del registro previo «%s»',
                r.fecha_hora_huso_gen, r.prev_fh)
    from recalculadas r
   where r.prev_fh is not null
     and r.fecha_hora_huso_gen::timestamptz < r.prev_fh::timestamptz
  union all
  select r.user_id, r.id, r.correlativo, 'FECHA_FUTURA',
         format('FechaHoraHusoGenRegistro «%s» posterior a la hora actual del sistema', r.fecha_hora_huso_gen)
    from recalculadas r
   where r.fecha_hora_huso_gen::timestamptz > now() + interval '5 minutes'
  union all
  select c.user_id, c.ultimo_registro_id, c.correlativo_ultimo, 'CADENA_DESINCRONIZADA',
         format('sif_cadena apunta a correlativo %s / huella «%s» pero los registros llegan a %s / «%s»',
                c.correlativo_ultimo, coalesce(c.ultima_huella, ''),
                coalesce(u.max_corr, 0), coalesce(u.ultima, ''))
    from public.sif_cadena c
    left join (
      select r2.user_id, max(r2.correlativo) as max_corr,
             (array_agg(r2.huella order by r2.correlativo desc))[1] as ultima
        from public.sif_registros r2
       group by r2.user_id
    ) u on u.user_id = c.user_id
   where (p_user_id is null or c.user_id = p_user_id)
     and (c.correlativo_ultimo <> coalesce(u.max_corr, 0)
          or (coalesce(u.max_corr, 0) > 0 and c.ultima_huella is distinct from u.ultima))
  order by 1, 3, 4
$$;

revoke all on function public.sif_detectar_anomalias(uuid) from public, anon, authenticated;
grant execute on function public.sif_detectar_anomalias(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4. sif_registrar_evento: anota un evento en sif_eventos con su cadena de
--    huellas PROPIA (doc. AEAT huella §3.c; art. 9 Orden). Kuentas v1 opera
--    solo como VERI*FACTU y está EXENTO de eventos (art. 3 Orden): esto es un
--    registro interno como producto total; el XML firmado XAdES llega en V14.
--    Los valores del bloque SistemaInformatico son los MISMOS constantes que
--    sistemaInformaticoKuentas() en lib/verifactu/registro-alta.ts.
-- -----------------------------------------------------------------------------
create or replace function public.sif_evento_tipo_oficial(p_tipo text)
returns text
language sql
immutable
as $$
  select case p_tipo
    when 'inicio_no_verifactu'            then '01'
    when 'fin_no_verifactu'               then '02'
    when 'deteccion_anomalias_registros'  then '03'
    when 'anomalia_registro'              then '04'
    when 'deteccion_anomalias_eventos'    then '05'
    when 'anomalia_evento'                then '06'
    when 'restauracion_copia'             then '07'
    when 'export_registros'               then '08'
    when 'export_eventos'                 then '09'
    when 'resumen_periodico'              then '10'
  end
$$;

create or replace function public.sif_registrar_evento(
  p_user_id uuid,
  p_tipo_evento text,
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
  v_id          uuid := gen_random_uuid();
begin
  if auth.uid() is not null then
    raise exception 'SIF_SOLO_SERVICIO: los eventos los registra el servidor (service_role)';
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
       'NIF=B98407901'
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
    coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('tipoEventoOficial', v_tipo_oficial),
    v_huella_ant is null, v_huella_ant, v_huella, v_fh);

  return query select v_id, v_correlativo, v_huella, v_huella_ant, v_fh, (v_huella_ant is null);
end;
$$;

revoke all on function public.sif_evento_tipo_oficial(text) from public, anon, authenticated;
revoke all on function public.sif_registrar_evento(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.sif_evento_tipo_oficial(text) to service_role;
grant execute on function public.sif_registrar_evento(uuid, text, jsonb) to service_role;
