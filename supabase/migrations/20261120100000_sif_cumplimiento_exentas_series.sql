-- =============================================================================
-- Cumplimiento 20-nov-2026 · operaciones exentas, series separadas y
-- rectificativas de simplificadas
--
-- Qué corrige (hallado al contrastar la web con la app, main 71ab027):
--  1. EXENTAS. La factura con IVA «0 % (exento)» se registraba como operación
--     sujeta al 0 % (S1), sin causa de exención, y la factura no llevaba la
--     mención. Ahora la causa (lista L10 del diseño de registro VERI*FACTU,
--     E1-E6 para IVA) se guarda con la factura, queda congelada al emitir y la
--     emisión exige que el registro lleve esa misma causa.
--     Base: art. 6.1.j) y 7.1.i) RD 1619/2012 (mención de exención en la
--     factura); art. 10 RD 1007/2023 y anexo de la Orden HAC/1177/2024
--     (OperacionExenta en el desglose del registro de alta).
--  2. SERIES. Las simplificadas (F2) se numeraban en la serie F de las
--     completas. Art. 7.1.a) RD 1619/2012, último párrafo: si en un mismo año
--     natural se expiden facturas completas (art. 6) y simplificadas (art. 7),
--     es obligatoria la expedición mediante series separadas. Y art. 6.1.a).2.º:
--     las rectificativas, en serie específica en todo caso.
--     Ahora cada serie es de UNA clase y la base de datos lo impone:
--       F  → ordinaria (F1, F3)            S  → simplificada (F2)
--       R  → rectificativa (R1-R4)         RS → rectificativa de simplificadas (R5)
--  3. RECTIFICATIVAS DE SIMPLIFICADAS. La rectificativa de una F2/R5 es R5
--     (lista L2: «Factura rectificativa en facturas simplificadas») y la de una
--     completa es R1-R4; la emisión rechaza la combinación cruzada.
--
-- Idempotente: se puede aplicar más de una vez. No toca ningún registro
-- existente (añade columnas nulas y sustituye funciones por versiones
-- compatibles: mismas firmas y mismos permisos).
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. invoices: causa de exención y detalle del precepto
-- -----------------------------------------------------------------------------
alter table public.invoices add column if not exists operacion_exenta text
  check (operacion_exenta is null or operacion_exenta in ('E1','E2','E3','E4','E5','E6'));
alter table public.invoices add column if not exists exencion_detalle text
  check (exencion_detalle is null or char_length(exencion_detalle) <= 200);

comment on column public.invoices.operacion_exenta is
  'Causa de exención del IVA (lista L10 VERI*FACTU: E1 art. 20, E2 art. 21, E3 art. 22, E4 arts. 23 y 24, E5 art. 25, E6 otros). Solo con iva_rate = 0.';
comment on column public.invoices.exencion_detalle is
  'Precepto o aclaración de la exención que se imprime en la factura junto a la mención (art. 6.1.j RD 1619/2012).';

-- La causa de exención solo tiene sentido sin IVA repercutido.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'invoices_exenta_sin_iva' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices add constraint invoices_exenta_sin_iva
      check (operacion_exenta is null or (iva_rate = 0 and iva = 0));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Guard de inmutabilidad: la causa de exención es contenido fiscal
--    (idéntico a 20260911100400 más las dos columnas nuevas).
-- -----------------------------------------------------------------------------
create or replace function public.invoices_fiscal_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.verifactu_estado <> 'borrador' then
      raise exception 'Factura emitida: DELETE prohibido (art. 11 RD 1007/2023). Genere un registro de anulación.';
    end if;
    return old;
  end if;

  if old.verifactu_estado = 'borrador' then
    return new;  -- borradores libres (el flujo de emisión de V07 fija los campos fiscales)
  end if;

  -- Transiciones de estado permitidas: emitida -> rectificada | anulada. Nada más.
  if new.verifactu_estado <> old.verifactu_estado then
    if not (old.verifactu_estado = 'emitida'
            and new.verifactu_estado in ('rectificada', 'anulada')) then
      raise exception 'Transición de estado Verifactu no permitida: % -> %',
        old.verifactu_estado, new.verifactu_estado;
    end if;
  end if;

  if new.id <> old.id
     or new.user_id <> old.user_id
     or new.number is distinct from old.number
     or new.serie is distinct from old.serie
     or new.ejercicio is distinct from old.ejercicio
     or new.numero_fiscal is distinct from old.numero_fiscal
     or new.emitida_at is distinct from old.emitida_at
     or new.tipo_factura is distinct from old.tipo_factura
     or new.rectifica_invoice_id is distinct from old.rectifica_invoice_id
     or new.tipo_rectificativa is distinct from old.tipo_rectificativa
     or new.registro_alta_id is distinct from old.registro_alta_id
     or (old.registro_anulacion_id is not null
         and new.registro_anulacion_id is distinct from old.registro_anulacion_id)
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
     or new.client_id is distinct from old.client_id
     or new.client_name is distinct from old.client_name
     or new.client_nif is distinct from old.client_nif
     or new.client_address is distinct from old.client_address
     or new.client_email is distinct from old.client_email
     or new.items is distinct from old.items
     or new.subtotal is distinct from old.subtotal
     or new.iva is distinct from old.iva
     or new.iva_rate is distinct from old.iva_rate
     or new.irpf is distinct from old.irpf
     or new.irpf_rate is distinct from old.irpf_rate
     or new.total is distinct from old.total
     or new.date is distinct from old.date
     or new.operacion_exenta is distinct from old.operacion_exenta
     or new.exencion_detalle is distinct from old.exencion_detalle
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Factura emitida: el contenido fiscal es inmutable (art. 8.2 RD 1007/2023). Use rectificativa o anulación.';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. sif_series: cuatro clases de serie y una sola clase por serie
-- -----------------------------------------------------------------------------
-- Se retira el CHECK anterior de la columna `tipo` (dos clases) por su
-- definición, no por su nombre, por si en algún entorno se llamara distinto.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.sif_series'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.sif_series drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table public.sif_series add constraint sif_series_tipo_check
  check (tipo in ('ordinaria', 'simplificada', 'rectificativa', 'rectificativa_simplificada'));

comment on column public.sif_series.tipo is
  'Clase de factura de la serie: ordinaria (F1/F3), simplificada (F2), rectificativa (R1-R4) o rectificativa_simplificada (R5). Una serie no mezcla clases (arts. 6.1.a y 7.1.a RD 1619/2012).';

-- Reserva atómica de número (como en 20260911100100) que además impide mezclar
-- clases de factura en una serie: ni en el mismo ejercicio (el ON CONFLICT solo
-- incrementa si la clase coincide) ni en ejercicios distintos del mismo obligado.
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
  v_serie text := upper(p_serie);
  v_otra text;
begin
  -- Solo el propio usuario (JWT) o el backend con service_role (auth.uid() null).
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'sif_reservar_numero: user_id no coincide con el usuario autenticado';
  end if;

  if p_tipo is null
     or p_tipo not in ('ordinaria', 'simplificada', 'rectificativa', 'rectificativa_simplificada') then
    raise exception 'SIF_SERIE_CLASE: clase de serie inválida: "%"', p_tipo;
  end if;

  select s.tipo into v_otra
    from public.sif_series s
   where s.user_id = p_user_id and s.serie = v_serie and s.tipo <> p_tipo
   limit 1;
  if found then
    raise exception 'SIF_SERIE_CLASE: la serie "%" es de facturas de clase "%" y no admite una de clase "%" (series separadas: arts. 6.1.a y 7.1.a RD 1619/2012)',
      v_serie, v_otra, p_tipo;
  end if;

  insert into public.sif_series as s (user_id, serie, ejercicio, tipo, ultimo_numero)
  values (p_user_id, v_serie, p_ejercicio, p_tipo, 1)
  on conflict (user_id, serie, ejercicio)
  do update set ultimo_numero = s.ultimo_numero + 1, updated_at = now()
    where s.tipo = excluded.tipo
  returning s.ultimo_numero into v_num;

  if v_num is null then
    raise exception 'SIF_SERIE_CLASE: la serie "%" del ejercicio % es de otra clase de factura y no admite una de clase "%"',
      v_serie, p_ejercicio, p_tipo;
  end if;

  return query
    select v_num,
           format('%s-%s-%s', v_serie, p_ejercicio, lpad(v_num::text, 6, '0'));
end;
$$;

revoke all on function public.sif_reservar_numero(uuid, text, integer, text) from public;
revoke all on function public.sif_reservar_numero(uuid, text, integer, text) from anon;
grant execute on function public.sif_reservar_numero(uuid, text, integer, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. sif_emitir_factura: serie por clase de factura, causa de exención
--    coherente y R5 solo para rectificar simplificadas.
--    El resto es IDÉNTICO a 20260919110000_sif_multitenant.sql (V15).
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
  v_rectificada   public.invoices%rowtype;
  v_cadena        public.sif_cadena%rowtype;
  v_tipo_factura  text;
  v_clase         text;
  v_exenta        text;
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

  -- Causa de exención: la del registro debe ser exactamente la de la factura
  -- (la app trabaja con una única línea de desglose). Sin esto, el registro
  -- podría decir una cosa y la factura impresa otra.
  v_exenta := p_registro #>> '{entrada,desglose,0,operacionExenta}';
  if v_exenta is distinct from v_invoice.operacion_exenta then
    raise exception 'SIF_EXENTA: la causa de exención del registro (%) no coincide con la de la factura (%)',
      coalesce(v_exenta, 'ninguna'), coalesce(v_invoice.operacion_exenta, 'ninguna');
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
    -- R5 es la rectificativa de las simplificadas (F2/R5); R1-R4, la de las completas.
    if v_rectificada.tipo_factura in ('F2', 'R5') and v_tipo_factura <> 'R5' then
      raise exception 'SIF_RECTIFICATIVA: la factura rectificada es simplificada (%): su rectificativa debe ser R5, no %',
        v_rectificada.tipo_factura, v_tipo_factura;
    end if;
    if v_rectificada.tipo_factura in ('F1', 'F3', 'R1', 'R2', 'R3', 'R4') and v_tipo_factura = 'R5' then
      raise exception 'SIF_RECTIFICATIVA: R5 solo rectifica facturas simplificadas; la rectificada es %',
        v_rectificada.tipo_factura;
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

  -- Numeración correlativa en servidor (D-01), una serie por clase de factura
  -- (arts. 6.1.a y 7.1.a RD 1619/2012): F completas · S simplificadas ·
  -- R rectificativas · RS rectificativas de simplificadas. sif_reservar_numero
  -- rechaza una serie que ya sea de otra clase.
  v_clase := case
    when v_tipo_factura = 'F2' then 'simplificada'
    when v_tipo_factura = 'R5' then 'rectificativa_simplificada'
    when v_tipo_factura like 'R%' then 'rectificativa'
    else 'ordinaria'
  end;
  v_serie := upper(coalesce(nullif(btrim(p_serie), ''), case v_clase
    when 'simplificada' then 'S'
    when 'rectificativa' then 'R'
    when 'rectificativa_simplificada' then 'RS'
    else 'F'
  end));
  v_ejercicio := extract(year from v_invoice.date)::integer;
  select r.numero, r.num_serie_factura into v_numero, v_nsf
    from public.sif_reservar_numero(p_user_id, v_serie, v_ejercicio, v_clase) r;

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
