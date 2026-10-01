# ---------------------------------------------------------------------------
# V26 · Alta de Mercadonet como primer cliente + ciclo completo EN VIVO contra
# el entorno de PRUEBAS de la AEAT, con el certificado del ALMACÉN DE WINDOWS
# (clave no exportable → curl.exe/Schannel, mismo flujo que V17/V18).
#
#   powershell -ExecutionPolicy Bypass -File scripts\verifactu-alta-mercadonet.ps1 [-Thumbprint <hex>] [-OutDir <dir>]
#
# Flujo: --preparar (sandbox + envelope, sin red) → POST a prewww1 →
# --consolidar (cierre del lote, verificación, export ClassicConta) →
# cotejo del QR de cada factura en prewww2 (evidencia en cotejo-N.html).
# Exit 0 = ciclo completo CONFORME. Requiere Node ≥ 22 y curl.exe de Windows.
# ---------------------------------------------------------------------------
param(
  [string]$Thumbprint = '',
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if ($OutDir -eq '') { $OutDir = Join-Path $env:TEMP ("verifactu-v26-" + (Get-Date -Format 'yyyyMMddHHmmss')) }

# --- 1. Certificado de representante de Mercadonet ---------------------------
if ($Thumbprint -eq '') {
  $certs = Get-ChildItem Cert:\CurrentUser\My | Where-Object {
    $_.HasPrivateKey -and $_.Subject -match 'VATES-B98407901' -and $_.NotAfter -gt (Get-Date)
  }
  if (-not $certs) {
    Write-Error 'No hay certificado con clave privada para VATES-B98407901 en Cert:\CurrentUser\My. Indique -Thumbprint.'
  }
  $cert = $certs | Sort-Object NotAfter -Descending | Select-Object -First 1
  $Thumbprint = $cert.Thumbprint
  Write-Host "Certificado: caduca $($cert.NotAfter.ToString('dd/MM/yyyy')) · $Thumbprint"
}

Push-Location $repo
try {
  # --- 2. Sandbox + facturas de prueba + envelope (sin red) ------------------
  & node scripts/verifactu-alta-mercadonet.mjs --preparar --dir $OutDir
  if ($LASTEXITCODE -ne 0) { Write-Error "--preparar falló (exit $LASTEXITCODE)" }

  $meta = Get-Content (Join-Path $OutDir 'meta.json') -Raw | ConvertFrom-Json
  $envelope = Join-Path $OutDir 'envelope.xml'
  $respuesta = Join-Path $OutDir 'respuesta.xml'

  # --- 3. POST del lote a prewww1 (mTLS Schannel) ----------------------------
  $status = & curl.exe --silent --show-error `
    --cert "CurrentUser\MY\$Thumbprint" `
    --header 'Content-Type: text/xml; charset=UTF-8' `
    --header 'SOAPAction: ""' `
    --header 'Accept: text/xml' `
    --data-binary "@$envelope" `
    --output $respuesta `
    --write-out '%{http_code}' `
    --max-time 60 `
    $meta.url
  if ($LASTEXITCODE -ne 0) { Write-Error "curl falló (exit $LASTEXITCODE). ¿Certificado/red?" }
  Write-Host "HTTP $status · respuesta en $respuesta"

  # --- 4. Cierre del lote + verificación del ciclo completo ------------------
  & node scripts/verifactu-alta-mercadonet.mjs --consolidar --dir $OutDir
  $exitConsolidar = $LASTEXITCODE

  # --- 5. Cotejo del QR de cada factura en prewww2 (evidencia) ---------------
  $i = 0
  foreach ($url in $meta.cotejos) {
    $i++
    $html = Join-Path $OutDir "cotejo-$i.html"
    & curl.exe --silent --show-error --location `
      --cert "CurrentUser\MY\$Thumbprint" `
      --output $html --max-time 60 $url | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Warning "cotejo $i : curl falló (exit $LASTEXITCODE)"; continue }
    $texto = Get-Content $html -Raw
    if ($texto -match 'Encontrada') { Write-Host "cotejo $i : factura ENCONTRADA en el portal de pruebas ($html)" }
    else { Write-Warning "cotejo $i : sin «Encontrada» en la respuesta (revisar $html)" }
  }

  Write-Host "`nEvidencias en $OutDir"
  exit $exitConsolidar
} finally {
  Pop-Location
}
