-- Caducidad mensual de los planes de pago de KUENTAS.EU (8-nov-2026, aprobada por Iván).
--
-- Cada pago confirmado por el TPV de BBVA (Redsys) cubre un mes: /api/redsys/notify fija plan_expires_at = la
-- mayor entre ahora y la caducidad vigente, más un mes. La app trata como Gratis una cuenta caducada hace más de
-- 7 días (lib/plan.ts) y /api/cron/plan-caducidad avisa por email 7 días antes, el día antes y el día de la
-- caducidad, con el enlace para renovar. No hay cargos automáticos.
--
-- El código funciona antes y después de aplicar este SQL. Es idempotente: se puede volver a ejecutar.

BEGIN;

-- 1) Caducidad y avisos ya enviados para esa caducidad (claves «d7@AAAA-MM-DD»; se vacía en cada pago).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_avisos_enviados text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.plan_expires_at IS
  'Fin del mes pagado del plan (caducidad mensual). NULL = sin caducidad: anterior al 8-nov-2026 o gestionado por Stripe.';
COMMENT ON COLUMN public.profiles.plan_avisos_enviados IS
  'Avisos de caducidad enviados (tipo@fecha de caducidad). Se vacía en cada pago.';

-- 2) Cuentas de pago que ya existían, sin caducidad ni suscripción de Stripe: un mes desde hoy, para no
--    quitarles el servicio de golpe. Recibirán los avisos como el resto.
UPDATE public.profiles
   SET plan_expires_at = now() + interval '1 month'
 WHERE coalesce(plan, 'gratis') <> 'gratis'
   AND plan_expires_at IS NULL
   AND stripe_subscription_id IS NULL;

-- 3) El plan, su caducidad y los datos de Stripe solo los cambia el servidor (service_role) o el editor SQL.
--    La política «Users can update own profile» deja a cada usuario actualizar su fila entera desde el
--    navegador: sin esto, cualquiera podía ponerse un plan de pago o alargar su caducidad.
CREATE OR REPLACE FUNCTION public.profiles_proteger_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
    NEW.plan := OLD.plan;
    NEW.plan_expires_at := OLD.plan_expires_at;
    NEW.plan_avisos_enviados := OLD.plan_avisos_enviados;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_plan ON public.profiles;
CREATE TRIGGER profiles_proteger_plan
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_proteger_plan();

COMMIT;

-- Comprobación (lo que enseña el editor al terminar): cuentas por plan, cuántas tienen caducidad y el trigger.
SELECT coalesce(plan, 'gratis') AS plan,
       count(*) AS cuentas,
       count(plan_expires_at) AS con_caducidad,
       min(plan_expires_at) AS primera_caducidad,
       (SELECT count(*) FROM pg_trigger WHERE tgname = 'profiles_proteger_plan') AS trigger_proteccion
  FROM public.profiles
 GROUP BY 1
 ORDER BY 1;
