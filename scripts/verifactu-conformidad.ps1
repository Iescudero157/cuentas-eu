# ---------------------------------------------------------------------------
# V18 - Bateria de conformidad E2E contra el entorno de pruebas de la AEAT
# usando el certificado del ALMACEN DE WINDOWS (clave no exportable -> curl.exe
# con backend Schannel, como en V17).
#
#   powershell -ExecutionPolicy Bypass -File scripts\verifactu-conformidad.ps1
#   ... [-Thumbprint <hex>] [-OutDir <dir>]
#
# Flujo: genera el PLAN con verifactu-conformidad.mjs --plan (sin red), remite
# cada envelope en orden respetando el TiempoEsperaEnvio entre envios (art. 16
# Orden HAC/1177/2024), hace el cotejo publico ValidarQR y evalua el resultado
# con --evaluar. Exit 0 = bateria CONFORME. Requiere Node >= 22 y curl.exe.
# (Fichero deliberadamente en ASCII: PowerShell 5.1 lo lee como ANSI.)
# ---------------------------------------------------------------------------
param(
  [string]$Thumbprint = '',
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if ($OutDir -eq '') { $OutDir = Join-Path $env:TEMP ("verifactu-conformidad-" + (Get-Date -Format 'yyyyMMddHHmmss')) }
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

Push-Location $repo
try {
  # --- 2. Generar el plan (sin red) -----------------------------------------
  & node scripts/verifactu-conformidad.mjs --plan $OutDir
  if ($LASTEXITCODE -ne 0) { Write-Error "La generacion del plan fallo (exit $LASTEXITCODE)" }
  $plan = Get-Content (Join-Path $OutDir 'plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $espera = [int]$plan.esperaEntreEnviosS

  # --- 3. Remision secuencial ------------------------------------------------
  $primerEnvio = $true
  foreach ($paso in $plan.pasos) {
    if ($paso.tipo -eq 'cotejo') {
      # Cotejo publico (sin certificado): al final, tras registrar el caso 01.
      $salida = Join-Path $OutDir "$($paso.id).respuesta.html"
      Write-Host "[$($paso.id)] GET cotejo ValidarQR"
      & curl.exe --silent --show-error --output $salida --max-time 60 $paso.url
      if ($LASTEXITCODE -ne 0) { Write-Warning "cotejo fallo (exit $LASTEXITCODE); la evaluacion lo reflejara" }
      continue
    }

    # Duplicado: reutiliza el envelope del paso referenciado, byte a byte.
    $envelopeDe = $paso.PSObject.Properties['envelopeDe']
    if ($null -ne $envelopeDe -and $envelopeDe.Value) {
      $envelope = Join-Path $OutDir "$($envelopeDe.Value).envelope.xml"
    } else {
      $envelope = Join-Path $OutDir $paso.fichero
    }

    if (-not $primerEnvio) {
      Write-Host "    (espera de $espera s - TiempoEsperaEnvio, art. 16 Orden)"
      Start-Sleep -Seconds $espera
    }
    $primerEnvio = $false

    $respuesta = Join-Path $OutDir "$($paso.id).respuesta.xml"
    Write-Host "[$($paso.id)] POST $($paso.titulo)"
    $status = & curl.exe --silent --show-error `
      --cert "CurrentUser\MY\$Thumbprint" `
      --header 'Content-Type: text/xml; charset=UTF-8' `
      --header 'SOAPAction: ""' `
      --header 'Accept: text/xml' `
      --data-binary "@$envelope" `
      --output $respuesta `
      --write-out '%{http_code}' `
      --max-time 60 `
      $plan.urlEnvio
    if ($LASTEXITCODE -ne 0) { Write-Warning "curl fallo (exit $LASTEXITCODE); la evaluacion marcara el paso" }
    else { Write-Host "    HTTP $status" }
  }

  # --- 4. Evaluacion -----------------------------------------------------------
  & node scripts/verifactu-conformidad.mjs --evaluar $OutDir
  $codigo = $LASTEXITCODE
  Write-Host "Artefactos completos en: $OutDir"
  exit $codigo
} finally {
  Pop-Location
}
