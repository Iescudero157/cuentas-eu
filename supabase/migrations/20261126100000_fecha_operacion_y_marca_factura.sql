-- 26-nov-2026 (Iván): «añadimos Fecha de operación» y modelo de factura por cuenta.
--
-- 1) invoices.fecha_operacion: fecha en que se hizo la operación cuando es distinta de la de expedición
--    (art. 6.1.k RD 1619/2012). Va en la factura y en el registro VERI*FACTU (FechaOperacion). Sirve, por
--    ejemplo, para emitir hoy la factura del alquiler de enero, o para el cobro del TPV que se factura otro día.
-- 2) La fecha de operación es contenido fiscal: el guard de inmutabilidad la protege como el resto
--    (idéntico a 20261120100000 más una línea).
-- 3) profiles.factura_marca: modelo de factura de la cuenta (logo, colores y pie) que usa el PDF.
--
-- El código funciona antes y después de aplicar este SQL. Es idempotente: se puede volver a ejecutar.

BEGIN;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fecha_operacion date;
COMMENT ON COLUMN public.invoices.fecha_operacion IS
  'Fecha de la operación si es distinta de la de expedición (art. 6.1.k RD 1619/2012; FechaOperacion de VERI*FACTU). NULL = la misma.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invoices_fecha_operacion_distinta' AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_fecha_operacion_distinta
      CHECK (fecha_operacion IS NULL OR fecha_operacion <> date);
  END IF;
END;
$$;

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
     or new.fecha_operacion is distinct from old.fecha_operacion
     or new.operacion_exenta is distinct from old.operacion_exenta
     or new.exencion_detalle is distinct from old.exencion_detalle
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Factura emitida: el contenido fiscal es inmutable (art. 8.2 RD 1007/2023). Use rectificativa o anulación.';
  end if;

  return new;
end;
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS factura_marca jsonb;
COMMENT ON COLUMN public.profiles.factura_marca IS
  'Modelo de factura de la cuenta: {logo (data URL PNG/JPEG), colorPrincipal, colorTitulo, colorSuave, pie}. NULL = diseño de Kuentas.';

-- Comprobación: tres «true».
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'fecha_operacion') AS fecha_operacion,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'factura_marca') AS factura_marca,
  (SELECT position('fecha_operacion' in prosrc) > 0 FROM pg_proc WHERE proname = 'invoices_fiscal_guard') AS guard_actualizado;

COMMIT;
