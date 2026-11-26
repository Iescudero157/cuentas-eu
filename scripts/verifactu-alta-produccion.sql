-- =====================================================================================================
-- Kuentas · Alta de MILBROTES, S.L. y MERCADONET GLOBAL S.L. como obligados VERI*FACTU en PRODUCCIÓN
-- 26-nov-2026 (versión 3: un solo comando, sin tabla temporal). Decisión de Iván en el chat: «Kuentas a producción».
--
-- Dónde: Supabase → proyecto kuentas-eu → SQL Editor → pegar todo → Run.
-- Se ejecuta DOS VECES (es el mismo SQL):
--   1.ª vez, en cuanto exista la cuenta de Kuentas de la empresa (app.kuentas.eu/registro, correo de abajo):
--      deja el perfil y la configuración VERI*FACTU creados, AÚN INACTIVOS. Sin ella, Ajustes no deja subir el
--      certificado («Antes de subir el certificado debe existir la configuración VERI*FACTU del emisor»).
--   Después: subir el certificado en Ajustes → Certificado digital, y poner la remisión cada minuto
--      (verifactu-cron-externo.ps1 -Instalar, como administrador).
--   2.ª vez: activa VERI*FACTU en el entorno de PRODUCCIÓN de la AEAT, con fecha de inicio de hoy, en la
--      empresa que ya tenga el certificado subido.
--
-- Qué pone en el perfil del emisor (sale en cada factura): razón social, NIF y domicilio de la escritura; sin
-- retención de IRPF por defecto (sociedad); plan Business sin caducidad (cuentas internas de la productora).
-- Ojo: una vez iniciado VERI*FACTU en producción, se mantiene al menos hasta el 31 de diciembre (art. 17 Orden
-- HAC/1177/2024); desde el 1-ene-2027 es obligatorio para las sociedades. Este SQL nunca desactiva una
-- configuración que ya esté activa. Si una cuenta se crea con otro correo, cambiar solo ese correo (abajo).
-- Es un único comando: o se aplica entero o no se aplica nada.
-- =====================================================================================================

with alta (correo, nif, razon, domicilio) as (
  values
    ('info@milbrotes.com', 'B05772710', 'MILBROTES, S.L.',        'Calle Belalcázar, 14, 28006 Madrid'),
    ('info@mercadonet.es', 'B98407901', 'MERCADONET GLOBAL S.L.', 'Ptda. Cortixelles, núm. 98, 46900 Torrent (Valencia)')
),
cuentas as (
  select a.*, u.id as user_id
    from alta a
    join auth.users u on lower(u.email) = a.correo
),
-- 1) Perfil del emisor (en cuanto existe la cuenta)
perfil as (
  update public.profiles p
     set name = c.razon,
         nif = c.nif,
         address = c.domicilio,
         retencion_irpf = 0,
         plan = 'business',
         plan_expires_at = null
    from cuentas c
   where p.id = c.user_id
  returning p.id, p.name, p.nif, p.address, p.plan
),
-- 2) Configuración VERI*FACTU: se crea inactiva; se activa (producción, fecha de inicio de hoy en España)
--    cuando la cuenta tiene un certificado activo. Nunca se desactiva aquí.
config as (
  insert into public.sif_config as sc
    (user_id, nif_obligado, nombre_razon, numero_instalacion, modalidad, entorno_aeat,
     certificado_ref, fecha_inicio_verifactu, activo)
  select c.user_id, c.nif, c.razon, 'KU-' || c.nif, 'verifactu', 'produccion',
         ce.id::text,
         case when ce.id is not null then (now() at time zone 'Europe/Madrid')::date end,
         ce.id is not null
    from cuentas c
    left join public.sif_certificados ce on ce.user_id = c.user_id and ce.estado = 'activo'
  on conflict (user_id) do update
     set nif_obligado = excluded.nif_obligado,
         nombre_razon = excluded.nombre_razon,
         modalidad = 'verifactu',
         certificado_ref = coalesce(excluded.certificado_ref, sc.certificado_ref),
         fecha_inicio_verifactu = case
           when sc.activo and sc.entorno_aeat = 'produccion' and sc.fecha_inicio_verifactu is not null
             then sc.fecha_inicio_verifactu
           when excluded.activo then excluded.fecha_inicio_verifactu
           else sc.fecha_inicio_verifactu end,
         entorno_aeat = 'produccion',
         activo = sc.activo or excluded.activo
  returning sc.user_id, sc.activo, sc.entorno_aeat, sc.fecha_inicio_verifactu
)
-- 3) Comprobación: una fila por empresa. Al final tiene que decir «ALTA HECHA» en las dos.
select a.razon,
       a.correo,
       case when cu.user_id is null then 'FALTA LA CUENTA'
            when ce.id is null and cf.activo then 'ACTIVA PERO SIN CERTIFICADO: sube uno en Ajustes'
            when ce.id is null then 'FALTA EL CERTIFICADO: súbelo en Ajustes y vuelve a ejecutar este SQL'
            when cf.activo and cf.entorno_aeat = 'produccion' then 'ALTA HECHA'
            else 'REVISAR' end                         as estado,
       cf.entorno_aeat,
       cf.activo,
       cf.fecha_inicio_verifactu,
       pf.name                                         as perfil_nombre,
       pf.nif                                          as perfil_nif,
       pf.address                                      as perfil_domicilio,
       pf.plan,
       ce.nif_representado                             as certificado_de,
       ce.valido_hasta                                 as certificado_caduca
  from alta a
  left join cuentas cu on cu.correo = a.correo
  left join perfil pf on pf.id = cu.user_id
  left join config cf on cf.user_id = cu.user_id
  left join public.sif_certificados ce on ce.user_id = cu.user_id and ce.estado = 'activo'
 order by a.razon;
