-- =====================================================================================================
-- Kuentas · Alta de MILBROTES, S.L. y MERCADONET GLOBAL S.L. como obligados VERI*FACTU en PRODUCCIÓN
-- 26-nov-2026. Decisión de Iván en el chat: «Kuentas a producción».
--
-- Dónde: Supabase → proyecto kuentas-eu → SQL Editor → pegar todo → Run.
-- Cuándo: SOLO después de estos tres pasos (ver el Word de la puesta en marcha):
--   1. existe la cuenta de Kuentas de cada empresa (app.kuentas.eu/registro) con el correo de abajo;
--   2. cada cuenta tiene subido su certificado en Ajustes → Certificado digital (.pfx o .p12);
--   3. la remisión vuelve a ir cada minuto (verifactu-cron-externo.ps1 -Instalar, como administrador).
--
-- Qué hace, por empresa con cuenta y certificado:
--   · perfil del emisor (sale en cada factura): razón social, NIF y domicilio de la escritura; sin retención
--     de IRPF por defecto (sociedad); plan Business sin caducidad (cuentas internas de la productora);
--   · VERI*FACTU activo en el entorno de PRODUCCIÓN de la AEAT desde hoy. Ojo: una vez iniciado, se mantiene
--     al menos hasta el 31 de diciembre (art. 17 Orden HAC/1177/2024); desde el 1-ene-2027 es obligatorio.
-- La empresa a la que le falte la cuenta o el certificado no se toca y sale en la tabla final con el motivo.
-- Se puede ejecutar más de una vez. Si una cuenta se crea con otro correo, cambiar solo ese correo.
-- =====================================================================================================

begin;

create temp table alta_obligados (correo text, nif text, razon text, domicilio text) on commit drop;
insert into alta_obligados values
  ('info@milbrotes.com', 'B05772710', 'MILBROTES, S.L.',        'Calle Belalcázar, 14, 28006 Madrid'),
  ('info@mercadonet.es', 'B98407901', 'MERCADONET GLOBAL S.L.', 'Ptda. Cortixelles, núm. 98, 46900 Torrent (Valencia)');

-- 1) Perfil del emisor
update public.profiles p
   set name = a.razon,
       nif = a.nif,
       address = a.domicilio,
       retencion_irpf = 0,
       plan = 'business',
       plan_expires_at = null
  from alta_obligados a
  join auth.users u on lower(u.email) = a.correo
  join public.sif_certificados c on c.user_id = u.id and c.estado = 'activo'
 where p.id = u.id;

-- 2) VERI*FACTU en producción desde hoy (fecha de España)
insert into public.sif_config as sc
  (user_id, nif_obligado, nombre_razon, numero_instalacion, modalidad, entorno_aeat,
   certificado_ref, fecha_inicio_verifactu, activo)
select u.id, a.nif, a.razon, 'KU-' || a.nif, 'verifactu', 'produccion',
       c.id::text, (now() at time zone 'Europe/Madrid')::date, true
  from alta_obligados a
  join auth.users u on lower(u.email) = a.correo
  join public.sif_certificados c on c.user_id = u.id and c.estado = 'activo'
on conflict (user_id) do update
   set nif_obligado = excluded.nif_obligado,
       nombre_razon = excluded.nombre_razon,
       modalidad = 'verifactu',
       certificado_ref = excluded.certificado_ref,
       fecha_inicio_verifactu = case
         when sc.entorno_aeat = 'produccion' and sc.fecha_inicio_verifactu is not null
           then sc.fecha_inicio_verifactu
         else excluded.fecha_inicio_verifactu end,
       entorno_aeat = 'produccion',
       activo = true;

-- 3) Comprobación: una fila por empresa. Tiene que decir «ALTA HECHA» en las dos.
select a.razon,
       a.correo,
       case when u.id is null then 'FALTA LA CUENTA'
            when c.id is null then 'FALTA EL CERTIFICADO'
            when s.activo and s.entorno_aeat = 'produccion' then 'ALTA HECHA'
            else 'REVISAR' end                         as estado,
       s.entorno_aeat,
       s.activo,
       s.fecha_inicio_verifactu,
       p.name                                          as perfil_nombre,
       p.nif                                           as perfil_nif,
       p.address                                       as perfil_domicilio,
       p.plan,
       c.nif_representado                              as certificado_de,
       c.valido_hasta                                  as certificado_caduca
  from alta_obligados a
  left join auth.users u on lower(u.email) = a.correo
  left join public.sif_certificados c on c.user_id = u.id and c.estado = 'activo'
  left join public.sif_config s on s.user_id = u.id
  left join public.profiles p on p.id = u.id
 order by a.razon;

commit;
