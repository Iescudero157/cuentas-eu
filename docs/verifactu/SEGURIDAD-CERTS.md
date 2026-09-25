# V11 · Seguridad de la custodia de certificados (modelo de amenazas)

**Ámbito.** Gestión del certificado electrónico con el que cada obligado remite
sus registros de facturación a la AEAT (mTLS, art. 5 Orden HAC/1177/2024).
Piezas: migración `20260918110000_sif_certificados.sql`, módulos
`lib/verifactu/cert-cifrado.ts`, `certificados.ts`, `cert-store.ts`, API
`app/api/verifactu/certificado` y tarjeta de Ajustes.

**Modelo elegido (plan maestro §4.3, decisión A).** v1 arranca con la opción A:
cada cliente sube SU certificado (el de Mercadonet como primer tenant
desbloquea las pruebas). El modelo queda preparado para la opción B
(certificado de representante) y para sello de entidad: columna `tipo`
(`obligado`/`representante`/`sello`), clasificación automática por
`IDCES-`/`VATES-` y selección de endpoint www1/www10 según el tipo.
**[REVISIÓN IVAN]** La adopción de la opción B como vía por defecto (un único
certificado de representante de Mercadonet para todos los clientes) es una
decisión de negocio + asesor fiscal pendiente; nada en el código la impide.

---

## 1. Activos a proteger

| Activo | Valor | Dónde vive |
| --- | --- | --- |
| Clave privada del certificado | CRÍTICO: firma/mTLS en nombre del obligado ante la AEAT | `sif_certificados.material_cifrado` (cifrado), RAM del worker durante el envío |
| Passphrase del PKCS#12 | Crítico (abre el fichero original) | Dentro del mismo sobre cifrado (solo formato `pfx`) |
| KEK de custodia | Crítico (descifra todos los sobres) | SOLO variable de entorno `VERIFACTU_CERT_KEK_BASE64` (Vercel/local), nunca en BD ni en el repo |
| Metadatos (titular, NIF, validez, huella) | Bajo (son públicos en el propio certificado) | Columnas en claro de `sif_certificados` |

## 2. Actores y amenazas → mitigaciones

**A1. Atacante con volcado de la base de datos** (backup robado, SQLi, acceso
Supabase de solo lectura)
- El material está cifrado con AES-256-GCM; la KEK no está en la BD → el
  volcado no da claves privadas. Solo expone metadatos (no sensibles).

**A2. Atacante con ESCRITURA en la base de datos** (intento de reasignar un
certificado a otro tenant para exfiltrarlo vía el worker)
- El AAD del sobre liga el cifrado a `sif_certificados:<id>:<user_id>`: un
  sobre copiado/movido de fila o de tenant NO descifra (verificado en test).
- Guard SQL write-once: metadatos y material inmutables; única transición
  `activo→retirado` (purga material); DELETE/TRUNCATE bloqueados incluso para
  `service_role`.

**A3. Tenant malicioso u otro usuario autenticado**
- RLS deny-all + `REVOKE ALL`: `anon`/`authenticated` no tienen NI SELECT
  sobre `sif_certificados` (el material jamás sale por PostgREST). Todo pasa
  por la API, que autentica la sesión y solo sirve metadatos del propio user.
- No puede subir el certificado de un tercero por error/abuso: el NIF del
  certificado (o el del representado) debe coincidir con `sif_config.nif_obligado`.

**A4. Atacante de red / cliente comprometido**
- La subida va una única vez por HTTPS al endpoint autenticado; el navegador
  no persiste ni el fichero ni la contraseña (no localStorage, no estado
  duradero). Tope de tamaño (256 KB) antes de tocar el parser.
- Payloads maliciosos al parser: node-forge parsea en memoria sin ejecutar
  contenido; contraseña y fichero se validan juntos (MAC PKCS#12) y los
  errores devueltos son tipados y sin material.

**A5. Logs y observabilidad** (Vercel logs, errores capturados)
- Regla dura en los cuatro módulos: NUNCA material/passphrase/KEK en mensajes
  de error ni logs. Los errores criptográficos se colapsan a mensajes
  operativos (p. ej. «sobre manipulado o contexto AAD incorrecto»). La API
  nunca devuelve el error crudo de una excepción inesperada.

**A6. Compromiso del servidor de aplicación (Vercel) o de sus env vars**
- RIESGO RESIDUAL ACEPTADO en v1: quien controle el runtime y la KEK puede
  descifrar los certificados de los tenants (inherente a que el worker
  necesita la clave para el mTLS). Mitigaciones previstas: microservicio
  `verifactu-gateway` en VPS propio como única pieza con acceso a
  certificados (plan maestro §4.2, se revalida en V17) y/o KMS externo (V24
  hardening). La rotación de KEK está soportada desde ya (ver §4).

**A7. Certificado caducado o robado al titular**
- Caducidad validada en la subida (se rechaza caducado o aún no válido), en
  cada consulta (`caduca_pronto` < 60 días, aviso en UI) y en cada tick del
  worker (un caducado NO se usa: la cola acumula con motivo).
- Retirada inmediata desde Ajustes: purga el material cifrado (queda solo el
  rastro de auditoría con la huella SHA-256 del certificado).

## 3. Decisiones de diseño

1. **Cifrado**: AES-256-GCM (autenticado), IV aleatorio de 96 bits por sobre,
   AAD = `sif_certificados:<id>:<user_id>`, formato versionado
   `v1.<kekId>.<iv>.<ct>.<tag>` (permite migrar de esquema sin adivinar).
2. **Normalización**: el PKCS#12 subido se convierte a PEM (clave PKCS#8 +
   cadena) cuando la clave es RSA — evita depender del soporte de PKCS#12
   legado (RC2/3DES) del OpenSSL del runtime — y se comprueba SIEMPRE con
   `tls.createSecureContext` que Node podrá usarlo. Claves no-RSA: se custodia
   el PKCS#12 original + passphrase (mismo sobre).
3. **Una fila = un certificado**, append-only, un único `activo` por obligado
   (índice parcial); `sif_config.certificado_ref` guarda la referencia opaca
   (diseño V03).
4. **El worker V10** obtiene el material por obligado (`materialRemision`);
   sin certificado utilizable el obligado se OMITE sin tocar su cola (la
   emisión nunca se detiene y los registros retenidos se remitirán con
   `Incidencia=S`, art. 16 Orden). Respaldo: certificado global de plataforma
   por variables de entorno (diseño V09), útil para pruebas V17.

## 4. Operativa

- **Alta de la custodia**: generar KEK con `openssl rand -base64 32` y ponerla
  en `VERIFACTU_CERT_KEK_BASE64` (Vercel + `.env.local`). Sin ella la API
  responde 503 y la UI avisa; nada se guarda sin cifrar.
- **Rotación de KEK**: mover la KEK vigente a
  `VERIFACTU_CERT_KEK_ANTERIOR_BASE64`, poner la nueva en
  `VERIFACTU_CERT_KEK_BASE64` y pedir a los usuarios re-subir el certificado
  (o re-cifrar en un job futuro); retirar la anterior cuando no queden sobres
  con su `kekId`.
- **Renovación de certificado**: la UI avisa desde 60 días antes
  (`caduca_pronto`); subir el nuevo retira y purga el anterior automáticamente.
- **Incidente (sospecha de fuga)**: retirar certificados desde Ajustes (purga
  material), rotar KEK, y el titular debe revocar el certificado ante su
  prestador (FNMT) — la revocación real NO depende de Kuentas.

## 5. Qué NO cubre v1 (honesto)

- No hay KMS/HSM: la KEK vive en variables de entorno (ver A6).
- No hay rate-limit específico del endpoint de subida (llega en V24
  hardening) — el coste de un intento es bajo y exige sesión válida.
- No se valida la CADENA de confianza contra las CAs admitidas por la AEAT
  (la AEAT la validará en el mTLS; hacerlo local llega con las pruebas V17).
- El re-cifrado masivo tras rotación de KEK es manual (re-subida) en v1.
