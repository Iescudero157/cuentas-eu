# Certificados de PRUEBA (solo tests V09)

Material criptográfico AUTOFIRMADO generado exclusivamente para los tests del
cliente SOAP AEAT (`v09-aeat-cliente.test.mjs`): levanta un servidor HTTPS
local con mTLS y verifica el intercambio completo. **No es un secreto**: no da
acceso a nada, no está emitido por ninguna CA real y no debe usarse jamás
fuera de los tests. El certificado real de producción NO vive en el repo
(custodia segura en V11).

- `ca.*`: CA de prueba (firma servidor y cliente).
- `servidor.*`: certificado TLS del mock (CN=localhost, SAN localhost/127.0.0.1).
- `cliente.*`: certificado cliente en PEM y en `cliente.pfx` (PKCS#12, clave «pruebas»).

Regeneración (OpenSSL ≥ 3): ver historial de V09 en PROGRESO.md.
