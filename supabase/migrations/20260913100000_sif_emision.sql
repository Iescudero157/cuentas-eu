-- =============================================================================
-- V07 · Verifactu · 6 — servicio de emisión transaccional
-- Base legal: art. 9 RD 1007/2023 (registro simultáneo a la expedición),
-- art. 12 RRSIF + art. 13 Orden HAC/1177/2024 (huella encadenada), art. 7 Orden
-- (encadenamiento por obligado), art. 11 RRSIF (anulación, nunca borrado),
-- art. 16 Orden (outbox de remisión). SPEC.md D-01/D-02/D-03/D-05/D-06, §5.5.
--
-- Diseño: la emisión es UNA función SQL security definer = UNA transacción.
-- Serializa por obligado con SELECT ... FOR UPDATE de sif_cadena, reserva el
-- número correlativo (sif_reservar_numero), calcula la huella SHA-256 oficial
-- (misma cadena de entrada que lib/verifactu/huella.ts, verificada contra los
-- vectores del doc. AEAT), inserta el registro append-only, lo encola en el
-- outbox y congela la factura (borrador → emitida) de forma atómica: o TODO
-- queda consistente o no se consume número ni eslabón de cadena.
-- El XML se fija después desde el servidor Next (sif_fijar_xml, una única vez,
-- NULL→valor); si faltara, se regenera determinista desde `registro` (jsonb).
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

-- pgcrypto para digest(); en Supabase ya está instalada (schema extensions).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    execute 'create extension pgcrypto';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Utilidades de formato oficial (idénticas a lib/verifactu/huella.ts)
-- -----------------------------------------------------------------------------

-- SHA-256 en hexadecimal, 64 caracteres, MAYÚSCULAS, sobre bytes UTF-8
-- (doc. AEAT «Especificaciones huella/hash» v0.1.2; TipoHuella=01).
-- search_path incluye `extensions` para resolver digest() donde viva pgcrypto.
create or replace function public.sif_sha256(p_texto text)
returns text
language sql
immutable
set search_path = extensions, public
as $$
  select upper(encode(digest(convert_to(p_texto, 'UTF8'), 'sha256'), 'hex'))
$$;

-- Importe con punto decimal y 2 decimales, sin separador de miles (como en XML).
create or replace function public.sif_formatear_importe(p_valor numeric)
returns text
language sql
immutable
as $$
  select to_char(round(p_valor, 2), 'FM999999999999999990.00')
$$;

-- FechaHoraHusoGenRegistro: ISO 8601 con el huso vigente en España peninsular
-- (Europe/Madrid, +01:00/+02:00), art. 10.1.m RRSIF, SPEC D-06.
create or replace function public.sif_fecha_hora_huso(p_ts timestamptz default now())
returns text
language plpgsql
stable
as $$
declare
  v_wall timestamp := p_ts at time zone 'Europe/Madrid';
  v_off  integer := extract(epoch from (v_wall - (p_ts at time zone 'UTC')))::integer;
begin
  return to_char(v_wall, 'YYYY-MM-DD"T"HH24:MI:SS')
    || case when v_off < 0 then '-' else '+' end
    || lpad((abs(v_off) / 3600)::text, 2, '0') || ':'
    || lpad(((abs(v_off) % 3600) / 60)::text, 2, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- sif_emitir_factura: emisión atómica de un registro de ALTA
--   p_registro: { entrada: EntradaRegistroAlta (numSerieFactura provisional),
--                 sistemaInformatico: {...} }  — el servidor Next lo construye y
--   VALIDA con construirRegistroAlta() ANTES de llamar (dry-run, para no quemar
--   números con facturas inválidas). Esta función fija numSerieFactura,
--   encadenamiento, fechaHoraHusoGenRegistro y huella dentro de la transacción.
-- -----------------------------------------------------------------------------
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

  -- Si es rectificativa de una factura de la app, marcarla (emitida → rectificada)
  if v_invoice.rectifica_invoice_id is not null then
    update public.invoices set verifactu_estado = 'rectificada', updated_at = now()
     where id = v_invoice.rectifica_invoice_id
       and user_id = p_user_id
       and verifactu_estado = 'emitida';
  end if;

  return query select v_registro_id, v_correlativo, v_numero, v_nsf,
    v_huella, v_huella_ant, v_fh, (v_huella_ant is null), v_invoice.date, v_tipo_factura;
end;
$$;

revoke all on function public.sif_emitir_factura(uuid, uuid, jsonb, numeric, numeric, text) from public;
revoke all on function public.sif_emitir_factura(uuid, uuid, jsonb, numeric, numeric, text) from anon;
grant execute on function public.sif_emitir_factura(uuid, uuid, jsonb, numeric, numeric, text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- sif_anular_factura: registro de ANULACIÓN atómico (D-12: sustituye al DELETE
-- de facturas emitidas; art. 11 RRSIF). Misma cadena que las altas (art. 7 Orden).
--   p_registro: { entrada: EntradaRegistroAnulacion, sistemaInformatico: {...} }
-- -----------------------------------------------------------------------------
create or replace function public.sif_anular_factura(
  p_user_id uuid,
  p_invoice_id uuid,
  p_registro jsonb
)
returns table (
  registro_id uuid,
  correlativo bigint,
  num_serie_factura text,
  huella text,
  huella_anterior text,
  fecha_hora_huso_gen text,
  primer_registro boolean,
  fecha_expedicion date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config        public.sif_config%rowtype;
  v_invoice       public.invoices%rowtype;
  v_cadena        public.sif_cadena%rowtype;
  v_fh            text;
  v_huella_ant    text;
  v_correlativo   bigint;
  v_cadena_entrada text;
  v_huella        text;
  v_encadenamiento jsonb;
  v_registro      jsonb;
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

  select * into v_invoice
    from public.invoices i
   where i.id = p_invoice_id and i.user_id = p_user_id
   for update;
  if not found then
    raise exception 'SIF_FACTURA: factura % no encontrada para el usuario', p_invoice_id;
  end if;
  if v_invoice.verifactu_estado <> 'emitida' then
    raise exception 'SIF_NO_EMITIDA: solo se anula una factura emitida (estado actual: "%")', v_invoice.verifactu_estado;
  end if;
  if v_invoice.numero_fiscal is null then
    raise exception 'SIF_SIN_NUMERO: la factura emitida no tiene numero_fiscal';
  end if;
  if (p_registro #>> '{entrada,numSerieFacturaAnulada}') is distinct from v_invoice.numero_fiscal then
    raise exception 'SIF_ANULACION: numSerieFacturaAnulada no coincide con la factura';
  end if;
  if (p_registro #>> '{entrada,emisor,nif}') is distinct from v_config.nif_obligado then
    raise exception 'SIF_EMISOR: el NIF emisor del registro no coincide con sif_config.nif_obligado';
  end if;

  select * into v_cadena from public.sif_cadena c where c.user_id = p_user_id for update;
  if not found then
    raise exception 'SIF_CADENA: el obligado no tiene cadena iniciada';
  end if;

  v_fh := public.sif_fecha_hora_huso(now());
  v_huella_ant := case when v_cadena.correlativo_ultimo = 0 then null else v_cadena.ultima_huella end;
  v_correlativo := v_cadena.correlativo_ultimo + 1;

  -- §4.2 SPEC: cadena de entrada del registro de anulación (5 campos)
  v_cadena_entrada :=
       'IDEmisorFacturaAnulada=' || v_config.nif_obligado
    || '&NumSerieFacturaAnulada=' || v_invoice.numero_fiscal
    || '&FechaExpedicionFacturaAnulada=' || to_char(v_invoice.date, 'DD-MM-YYYY')
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

  v_registro := jsonb_set(p_registro, '{encadenamiento}', v_encadenamiento);
  v_registro := jsonb_set(v_registro, '{fechaHoraHusoGenRegistro}', to_jsonb(v_fh));
  v_registro := jsonb_set(v_registro, '{tipoHuella}', to_jsonb('01'::text));
  v_registro := jsonb_set(v_registro, '{huella}', to_jsonb(v_huella));

  insert into public.sif_registros (
    id, user_id, correlativo, tipo_registro, invoice_id,
    id_emisor_factura, num_serie_factura, fecha_expedicion,
    registro, primer_registro, huella_anterior, huella, fecha_hora_huso_gen)
  values (
    v_registro_id, p_user_id, v_correlativo, 'anulacion', p_invoice_id,
    v_config.nif_obligado, v_invoice.numero_fiscal, v_invoice.date,
    v_registro, v_huella_ant is null, v_huella_ant, v_huella, v_fh);

  insert into public.sif_outbox (user_id, registro_id) values (p_user_id, v_registro_id);

  update public.sif_cadena set
    correlativo_ultimo = v_correlativo,
    ultimo_registro_id = v_registro_id,
    ultima_huella = v_huella,
    ultimo_num_serie_factura = v_invoice.numero_fiscal,
    ultima_fecha_expedicion = v_invoice.date,
    updated_at = now()
  where user_id = p_user_id;

  -- emitida → anulada (transición permitida por invoices_fiscal_guard)
  update public.invoices set
    verifactu_estado = 'anulada',
    registro_anulacion_id = v_registro_id,
    updated_at = now()
  where id = p_invoice_id;

  return query select v_registro_id, v_correlativo, v_invoice.numero_fiscal,
    v_huella, v_huella_ant, v_fh, (v_huella_ant is null), v_invoice.date;
end;
$$;

revoke all on function public.sif_anular_factura(uuid, uuid, jsonb) from public;
revoke all on function public.sif_anular_factura(uuid, uuid, jsonb) from anon;
grant execute on function public.sif_anular_factura(uuid, uuid, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- sif_fijar_xml: fija el XML exacto del registro UNA única vez (NULL → valor;
-- el trigger sif_registros_guard impide cualquier cambio posterior).
-- Devuelve true si lo fijó; false si ya estaba fijado o el registro no es suyo.
-- -----------------------------------------------------------------------------
create or replace function public.sif_fijar_xml(
  p_user_id uuid,
  p_registro_id uuid,
  p_xml text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'SIF_USUARIO: user_id no coincide con el usuario autenticado';
  end if;
  if p_xml is null or btrim(p_xml) = '' then
    raise exception 'SIF_XML: el XML no puede ser vacío';
  end if;

  update public.sif_registros
     set xml = p_xml
   where id = p_registro_id and user_id = p_user_id and xml is null;
  return found;
end;
$$;

revoke all on function public.sif_fijar_xml(uuid, uuid, text) from public;
revoke all on function public.sif_fijar_xml(uuid, uuid, text) from anon;
grant execute on function public.sif_fijar_xml(uuid, uuid, text) to authenticated, service_role;
