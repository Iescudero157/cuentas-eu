# ---------------------------------------------------------------------------
# V17 · Prueba de conexión al entorno de pruebas AEAT usando el certificado
# del ALMACÉN DE WINDOWS (clave privada NO exportable → node:https no puede
# usarla; curl.exe con backend Schannel sí).
#
#   powershell -ExecutionPolicy Bypass -File scripts\verifactu-prueba-aeat.ps1
#   ... [-Thumbprint <hex>] [-OutDir <dir>] [-Anular -Num <NumSerie> -Fecha <dd-mm-aaaa> -Huella <h64>]
#
# Flujo: genera el Envelope con verifactu-prueba-aeat.mjs --envelope (sin red),
# lo POSTea con curl --cert "CurrentUser\MY\<thumbprint>" y parsea la
# respuesta con --parsear. Exit 0 = EstadoEnvio Correcto.
# Requiere: Node ≥ 22 y el curl.exe de Windows (backend Schannel).
# ---------------------------------------------------------------------------
param(
  [string]$Thumbprint = '',
  [string]$OutDir = '',
  [switch]$Anular,
  [string]$Num = '',
  [string]$Fecha = '',
  [string]$Huella = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if ($OutDir -eq '') { $OutDir = Join-Path $env:TEMP ("verifactu-prueba-" + (Get-Date -Format 'yyyyMMddHHmmss')) }
New-Item -ItemType Directory -Force $OutDir | Out-Null

# --- 1. Certificado: localizar el de representante de Mercadonet ------------
if ($Thumbprint -eq '') {
  $certs = Get-ChildItem Cert:\CurrentUser\My | Where-Object {
    $_.HasPrivateKey -and $_.Subject -match 'VATES-B98407901' -and $_.NotAfter -gt (Get-Date)
  }
  if (-not $certs) {
    Write-Error 'No hay certificado con clave privada para VATES-B98407901 en Cert:\CurrentUser\My. Indique -Thumbprint.'
  }
  $cert = $certs | Sort-Object NotAfter -Descending | Select-Object -First 1
  $Thumbprint = $cert.Thumbprint
  Write-Host "Certificado: $($cert.Subject.Split(',')[3]) (caduca $($cert.NotAfter.ToString('dd/MM/yyyy')))"
}

# --- 2. Generar el Envelope SOAP (sin red) -----------------------------------
$envelope = Join-Path $OutDir 'envelope.xml'
$nodeArgs = @("scripts/verifactu-prueba-aeat.mjs", '--envelope', $envelope)
if ($Anular) { $nodeArgs += @('--anular', '--num', $Num, '--fecha', $Fecha, '--huella', $Huella) }
Push-Location $repo
try {
  & node @nodeArgs
  if ($LASTEXITCODE -ne 0) { Write-Error "La generación del envelope falló (exit $LASTEXITCODE)" }

  $meta = Get-Content "$envelope.meta.json" -Raw | ConvertFrom-Json
  $url = $meta.url

  # --- 3. POST con mTLS vía Schannel (certificado del almacén) ---------------
  $respuesta = Join-Path $OutDir 'respuesta.xml'
  $status = & curl.exe --silent --show-error `
    --cert "CurrentUser\MY\$Thumbprint" `
    --header 'Content-Type: text/xml; charset=UTF-8' `
    --header 'SOAPAction: ""' `
    --header 'Accept: text/xml' `
    --data-binary "@$envelope" `
    --output $respuesta `
    --write-out '%{http_code}' `
    --max-time 60 `
    $url
  if ($LASTEXITCODE -ne 0) { Write-Error "curl falló (exit $LASTEXITCODE). ¿Certificado/red?" }
  Write-Host "HTTP $status · respuesta en $respuesta"

  # --- 4. Informe -------------------------------------------------------------
  & node scripts/verifactu-prueba-aeat.mjs --parsear $respuesta
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
