-- =============================================================================
-- V24 · Hardening de seguridad del módulo Verifactu
--
-- 1) sif_config: el GRANT UPDATE de tabla completa a `authenticated` permitía
--    al tenant, vía PostgREST, escribir las columnas de CONTROL de remisión:
--    desactivar su propia remisión (activo, proximo_envio_desde,
--    circuito_abierto_hasta) mientras sus facturas siguen luciendo QR y
--    leyenda VERI*FACTU (incumplimiento art. 16 Orden HAC/1177/2024 imputable
--    a la plataforma), saltarse el control de flujo (tiempo_espera_envio) o
--    auto-activarse contra PRODUCCIÓN de la AEAT (entorno_aeat), contra la
--    decisión D-13. Este guard limita la escritura de usuario final
--    (auth.uid() no nulo) a las columnas de identificación; el plano de
--    control queda reservado al backend (service_role, auth.uid() nulo).
--
-- 2) anon: revocación explícita de todo privilegio en las tablas sif_*
--    (defensa en profundidad: las policies ya filtran por auth.uid(), pero
--    ningún privilegio heredado de ALTER DEFAULT PRIVILEGES debe sobrevivir).
--
-- NOTA (evaluado y descartado a propósito): FORCE ROW LEVEL SECURITY se
-- consideró y NO se aplica — las funciones sif_* SECURITY DEFINER se ejecutan
-- como propietario y necesitan escribir en tablas cuyo RLS no tiene policies
-- de escritura; la inalterabilidad ya la garantizan los triggers guard, que
-- aplican a TODOS los roles incluido service_role. Ver docs/verifactu/SEGURIDAD.md.
-- NOTA: NO aplicar contra producción desde el repo; solo ficheros de migración.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Guard de columnas de control de sif_config
-- -----------------------------------------------------------------------------
create or replace function public.sif_config_guard_control()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Contexto de backend (service_role / procesos internos): sin restricción.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- El usuario puede dar de alta su configuración, pero SOLO con el plano
    -- de control en valores seguros (activación y producción las gobierna
    -- Kuentas; decisión D-13 y flujo de alta documentado en la guía V21).
    if new.activo
       or new.entorno_aeat is distinct from 'pruebas'
       or new.modalidad is distinct from 'verifactu'
       or new.tiempo_espera_envio is distinct from 60
       or new.proximo_envio_desde is not null
       or new.fallos_consecutivos is distinct from 0
       or new.circuito_abierto_hasta is not null
       or new.certificado_ref is not null
       or new.fecha_inicio_verifactu is not null
       or new.fecha_fin_verifactu is not null then
      raise exception 'SIF_CONFIG_CONTROL: las columnas de control de remisión solo puede establecerlas la plataforma';
    end if;
    return new;
  end if;

  -- UPDATE de usuario final: prohibido tocar el plano de control.
  if new.activo is distinct from old.activo
     or new.entorno_aeat is distinct from old.entorno_aeat
     or new.modalidad is distinct from old.modalidad
     or new.tiempo_espera_envio is distinct from old.tiempo_espera_envio
     or new.proximo_envio_desde is distinct from old.proximo_envio_desde
     or new.fallos_consecutivos is distinct from old.fallos_consecutivos
     or new.circuito_abierto_hasta is distinct from old.circuito_abierto_hasta
     or new.certificado_ref is distinct from old.certificado_ref
     or new.fecha_inicio_verifactu is distinct from old.fecha_inicio_verifactu
     or new.fecha_fin_verifactu is distinct from old.fecha_fin_verifactu then
    raise exception 'SIF_CONFIG_CONTROL: las columnas de control de remisión solo puede modificarlas la plataforma';
  end if;
  return new;
end;
$$;

drop trigger if exists sif_config_guard_control on public.sif_config;
create trigger sif_config_guard_control
  before insert or update on public.sif_config
  for each row execute function public.sif_config_guard_control();

comment on function public.sif_config_guard_control() is
  'V24: reserva al backend (auth.uid() nulo) las columnas de control de remisión de sif_config; el usuario final solo gestiona su identificación.';

-- -----------------------------------------------------------------------------
-- 2) anon fuera de las tablas sif_* (sif_certificados ya lo hizo en V11)
-- -----------------------------------------------------------------------------
revoke all on table public.sif_config from anon;
revoke all on table public.sif_series from anon;
revoke all on table public.sif_cadena from anon;
revoke all on table public.sif_registros from anon;
revoke all on table public.sif_outbox from anon;
revoke all on table public.sif_eventos from anon;
