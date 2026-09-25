-- =============================================================================
-- V03 · Verifactu · 5/5 — invoices: estados fiscales e inmutabilidad post-emisión
-- Base legal: art. 9 RRSIF (registro al expedir), art. 11 RRSIF (anulación, no
-- borrado), art. 8.2 RRSIF (inalterabilidad). SPEC.md §5.5 (borrador → emitida →
-- rectificada | anulada), D-02, D-03, D-08, D-12. Corrige riesgos R2/R4 de V01.
-- Los borradores siguen siendo libremente editables y borrables: la app actual
-- no cambia de comportamiento hasta que V07 implemente el flujo de emisión.
-- =============================================================================

alter table public.invoices
  add column if not exists verifactu_estado text not null default 'borrador'
    check (verifactu_estado in ('borrador', 'emitida', 'rectificada', 'anulada'));
alter table public.invoices add column if not exists serie text;
alter table public.invoices add column if not exists ejercicio integer;
-- NumSerieFactura definitivo asignado por sif_reservar_numero() al emitir (≤60 ASCII)
alter table public.invoices add column if not exists numero_fiscal text
  check (numero_fiscal is null or char_length(numero_fiscal) between 1 and 60);
alter table public.invoices add column if not exists emitida_at timestamptz;
alter table public.invoices add column if not exists tipo_factura text
  check (tipo_factura is null or tipo_factura in ('F1','F2','F3','R1','R2','R3','R4','R5'));
-- Rectificativas (R1-R5): factura a la que rectifica y modalidad S/I (SPEC §2.1)
alter table public.invoices add column if not exists rectifica_invoice_id uuid
  references public.invoices(id) on delete restrict;
alter table public.invoices add column if not exists tipo_rectificativa text
  check (tipo_rectificativa is null or tipo_rectificativa in ('S', 'I'));
-- Enlaces a los registros de facturación generados
alter table public.invoices add column if not exists registro_alta_id uuid
  references public.sif_registros(id) on delete restrict;
alter table public.invoices add column if not exists registro_anulacion_id uuid
  references public.sif_registros(id) on delete restrict;
-- PDF único de servidor con QR y leyenda, persistido en Storage al emitir (D-08)
alter table public.invoices add column if not exists pdf_path text;

-- Unicidad de numeración fiscal por obligado (el legacy `number` puede tener
-- duplicados históricos — R1 de V01 —, por eso la unicidad se impone sobre la
-- nueva columna, solo cuando hay número fiscal asignado).
create unique index if not exists invoices_user_numero_fiscal_uq
  on public.invoices (user_id, numero_fiscal) where numero_fiscal is not null;
create index if not exists invoices_user_verifactu_estado_idx
  on public.invoices (user_id, verifactu_estado);

-- -----------------------------------------------------------------------------
-- Guard de inmutabilidad post-emisión:
--  · DELETE solo de borradores (D-12: para emitidas, registro de anulación).
--  · Con estado <> 'borrador' el contenido fiscal queda congelado; solo pueden
--    cambiar los metadatos de cobro (status/payment_*/due_date/notes), el estado
--    Verifactu (transiciones válidas) y los campos que se fijan una única vez
--    en la emisión/anulación (pdf_path, registro_anulacion_id).
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
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Factura emitida: el contenido fiscal es inmutable (art. 8.2 RD 1007/2023). Use rectificativa o anulación.';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_fiscal_guard_upd on public.invoices;
create trigger invoices_fiscal_guard_upd
  before update on public.invoices
  for each row execute function public.invoices_fiscal_guard();

drop trigger if exists invoices_fiscal_guard_del on public.invoices;
create trigger invoices_fiscal_guard_del
  before delete on public.invoices
  for each row execute function public.invoices_fiscal_guard();
