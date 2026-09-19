-- =============================================================================
-- V15 · Verifactu · multi-tenant y concurrencia — orden de bloqueos de la emisión
-- Base legal: art. 7 Orden HAC/1177/2024 (una cadena por obligado), art. 9
-- RD 1007/2023 (registro simultáneo a la expedición). SPEC.md D-01/D-05.
--
-- Qué corrige (detectado en la revisión de concurrencia de V15):
--  1. INTERBLOQUEO potencial rectificativa/anulación: sif_emitir_factura (V07)
--     bloqueaba la factura a emitir y la fila de sif_cadena, pero actualizaba la
--     factura RECTIFICADA al final SIN haberla bloqueado antes. Con dos sesiones
--     concurrentes — T1 emite la rectificativa (lock factura R → lock cadena →
--     update rectificada) y T2 anula la rectificada (lock rectificada → lock
--     cadena) — cada una espera un lock que tiene la otra: deadlock que Postgres
--     resuelve abortando una transacción (error 40P01 para el usuario).
--     Solución: TODAS las funciones de la cadena adquieren los locks en el mismo
--     orden global: filas de invoices primero, sif_cadena después. La factura
--     rectificada se bloquea con FOR UPDATE justo tras la factura a emitir y
--     ANTES del lock de cadena.
--  2. Referencia cruzada entre tenants: si rectifica_invoice_id apuntara a una
--     factura de OTRO usuario (la FK de invoices no restringe por user_id), la
--     emisión seguía adelante y el update final quedaba en no-op silencioso.
--     Ahora la rectificada se resuelve con user_id = p_user_id y, si no existe
--     para ese usuario, la emisión falla con SIF_RECTIFICADA (defensa en
--     profundidad; la capa Next ya filtra por sesión).
--
-- El resto de la función es IDÉNTICO a 20260913100000_sif_emision.sql (V07).
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

create or replace function public.sif_emitir_factura(
  p_user_id uuid,
  p_invoice_id uuid,
  p_registro jsonb,
  p_cuota_total numeric,
  p_importe_total numeric,
  p_serie text default null
)
returns table (
  registro_id uuid,
  correlativo bigint,
  numero integer,
  num_serie_factura text,
  huella text,
  huella_anterior text,
  fecha_hora_huso_gen text,
  primer_registro boolean,
  fecha_expedicion date,
  tipo_factura text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config        public.sif_config%rowtype;
  v_invoice       public.invoices%rowtype;
  v_rectificada   public.invoices%rowtype;
  v_cadena        public.sif_cadena%rowtype;
  v_tipo_factura  text;
  v_serie         text;
  v_ejercicio     integer;
  v_numero        integer;
  v_nsf           text;
  v_fh            text;
  v_huella_ant    text;
  v_correlativo   bigint;
  v_cadena_entrada text;
  v_huella        text;
  v_encadenamiento jsonb;
  v_registro      jsonb;
  v_registro_id   uuid := gen_random_uuid();
begin
  -- Solo el propio usuario (JWT) o el backend con service_role (auth.uid() null)
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'SIF_USUARIO: user_id no coincide con el usuario autenticado';
  end if;

  -- Feature flag por empresa (sif_config.activo) y modalidad
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

  -- Consistencia mínima del registro recibido
  v_tipo_factura := upper(coalesce(p_registro #>> '{entrada,tipoFactura}', ''));
  if v_tipo_factura not in ('F1','F2','F3','R1','R2','R3','R4','R5') then
    raise exception 'SIF_TIPO_FACTURA: TipoFactura inválido: "%"', v_tipo_factura;
  end if;
  if p_cuota_total is null or p_importe_total is null then
    raise exception 'SIF_IMPORTES: cuota_total e importe_total son obligatorios';
  end if;
  if (p_registro #>> '{entrada,emisor,nif}') is distinct from v_config.nif_obligado then
    raise exception 'SIF_EMISOR: el NIF emisor del registro no coincide con sif_config.nif_obligado';
  end if;

  -- Factura: bloqueada, del usuario y en borrador (emisión única, art. 9 RRSIF)
  select * into v_invoice
    from public.invoices i
   where i.id = p_invoice_id and i.user_id = p_user_id
   for update;
  if not found then
    raise exception 'SIF_FACTURA: factura % no encontrada para el usuario', p_invoice_id;
  end if;
  if v_invoice.verifactu_estado <> 'borrador' then
    raise exception 'SIF_NO_BORRADOR: la factura ya está "%"; una factura solo se emite una vez', v_invoice.verifactu_estado;
  end if;
  if v_invoice.date is null then
    raise exception 'SIF_FECHA: la factura no tiene fecha de expedición';
  end if;
  if v_invoice.rectifica_invoice_id is not null and v_tipo_factura not like 'R%' then
    raise exception 'SIF_RECTIFICATIVA: la factura referencia rectifica_invoice_id pero TipoFactura=%', v_tipo_factura;
  end if;

  -- Rectificada: bloquear ANTES que la cadena (orden global invoices → sif_cadena;
  -- evita el interbloqueo con sif_anular_factura) y exigir que sea del MISMO
  -- usuario (aislamiento multi-tenant, defensa en profundidad).
  if v_invoice.rectifica_invoice_id is not null then
    select * into v_rectificada
      from public.invoices i
     where i.id = v_invoice.rectifica_invoice_id and i.user_id = p_user_id
     for update;
    if not found then
      raise exception 'SIF_RECTIFICADA: la factura rectificada % no existe para el usuario', v_invoice.rectifica_invoice_id;
    end if;
  end if;

  -- Cadena del obligado (art. 7 Orden): crear si no existe y BLOQUEAR (serializa
  -- las emisiones concurrentes del mismo obligado; D-05)
  insert into public.sif_cadena (user_id, nif_obligado)
  values (p_user_id, v_config.nif_obligado)
  on conflict (user_id) do nothing;

  select * into v_cadena from public.sif_cadena c where c.user_id = p_user_id for update;
  if v_cadena.nif_obligado <> v_config.nif_obligado then
    raise exception 'SIF_CADENA: NIF de la cadena inconsistente con sif_config';
  end if;

  -- Numeración correlativa en servidor (D-01): serie F ordinaria / R rectificativa
  v_serie := upper(coalesce(p_serie, case when v_tipo_factura like 'R%' then 'R' else 'F' end));
  v_ejercicio := extract(year from v_invoice.date)::integer;
  select r.numero, r.num_serie_factura into v_numero, v_nsf
    from public.sif_reservar_numero(
      p_user_id, v_serie, v_ejercicio,
      case when v_tipo_factura like 'R%' then 'rectificativa' else 'ordinaria' end) r;

  -- Huella encadenada (art. 12 RRSIF; §4.1 SPEC — misma cadena que huella.ts)
  v_fh := public.sif_fecha_hora_huso(now());
  v_huella_ant := case when v_cadena.correlativo_ultimo = 0 then null else v_cadena.ultima_huella end;
  v_correlativo := v_cadena.correlativo_ultimo + 1;

  v_cadena_entrada :=
       'IDEmisorFactura=' || v_config.nif_obligado
    || '&NumSerieFactura=' || v_nsf
    || '&FechaExpedicionFactura=' || to_char(v_invoice.date, 'DD-MM-YYYY')
    || '&TipoFactura=' || v_tipo_factura
    || '&CuotaTotal=' || public.sif_formatear_importe(p_cuota_total)
    || '&ImporteTotal=' || public.sif_formatear_importe(p_importe_total)
    || '&Huella=' || coalesce(v_huella_ant, '')
    || '&FechaHoraHusoGenRegistro=' || v_fh;
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

  -- Contenido oficial completo (fuente única para regenerar el XML)
  v_registro := jsonb_set(p_registro, '{entrada,numSerieFactura}', to_jsonb(v_nsf));
  v_registro := jsonb_set(v_registro, '{encadenamiento}', v_encadenamiento);
  v_registro := jsonb_set(v_registro, '{fechaHoraHusoGenRegistro}', to_jsonb(v_fh));
  v_registro := jsonb_set(v_registro, '{tipoHuella}', to_jsonb('01'::text));
  v_registro := jsonb_set(v_registro, '{huella}', to_jsonb(v_huella));

  insert into public.sif_registros (
    id, user_id, correlativo, tipo_registro, invoice_id,
    id_emisor_factura, num_serie_factura, fecha_expedicion,
    tipo_factura, cuota_total, importe_total, registro,
    primer_registro, huella_anterior, huella, fecha_hora_huso_gen)
  values (
    v_registro_id, p_user_id, v_correlativo, 'alta', p_invoice_id,
    v_config.nif_obligado, v_nsf, v_invoice.date,
    v_tipo_factura, round(p_cuota_total, 2), round(p_importe_total, 2), v_registro,
    v_huella_ant is null, v_huella_ant, v_huella, v_fh);

  -- Outbox en la misma transacción (patrón outbox, D-04)
  insert into public.sif_outbox (user_id, registro_id) values (p_user_id, v_registro_id);

  update public.sif_cadena set
    correlativo_ultimo = v_correlativo,
    ultimo_registro_id = v_registro_id,
    ultima_huella = v_huella,
    ultimo_num_serie_factura = v_nsf,
    ultima_fecha_expedicion = v_invoice.date,
    updated_at = now()
  where user_id = p_user_id;

  -- La factura queda emitida e INMUTABLE (trigger invoices_fiscal_guard)
  update public.invoices set
    verifactu_estado = 'emitida',
    serie = v_serie,
    ejercicio = v_ejercicio,
    numero_fiscal = v_nsf,
    number = v_nsf,
    tipo_factura = v_tipo_factura,
    emitida_at = now(),
    registro_alta_id = v_registro_id,
    updated_at = now()
  where id = p_invoice_id;

  -- Si es rectificativa de una factura de la app, marcarla (emitida → rectificada).
  -- La fila ya está bloqueada arriba; si su estado no es 'emitida' (p. ej. ya
  -- rectificada por otra parcial, o anulada) se deja tal cual, como en V07.
  if v_invoice.rectifica_invoice_id is not null
     and v_rectificada.verifactu_estado = 'emitida' then
    update public.invoices set verifactu_estado = 'rectificada', updated_at = now()
     where id = v_invoice.rectifica_invoice_id;
  end if;

  return query select v_registro_id, v_correlativo, v_numero, v_nsf,
    v_huella, v_huella_ant, v_fh, (v_huella_ant is null), v_invoice.date, v_tipo_factura;
end;
$$;

revoke all on function public.sif_emitir_factura(uuid, uuid, jsonb, numeric, numeric, text) from public;
revoke all on function public.sif_emitir_factura(uuid, uuid, jsonb, numeric, numeric, text) from anon;
grant execute on function public.sif_emitir_factura(uuid, uuid, jsonb, numeric, numeric, text)
  to authenticated, service_role;
