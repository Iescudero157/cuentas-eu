# verifactu-cron-externo.ps1 — disparo externo por minuto del cron de remision VERI*FACTU.
#
# Por que existe: el plan Hobby de Vercel solo admite crons DIARIOS y con "* * * * *" el
# deploy entero falla (verificado 25-09-2026 en el preview del PR #1). vercel.json queda a
# "0 3 * * *" como red de seguridad; la cadencia por minuto que necesita la remision
# continua VERI*FACTU (art. 16 Orden HAC/1177/2024, TiempoEsperaEnvio) la aporta esta
# tarea externa — o Vercel Pro, si Ivan lo contrata (entonces restaurar "* * * * *").
#
# Uso:
#   .\verifactu-cron-externo.ps1                         una llamada al endpoint (la accion de la tarea)
#   .\verifactu-cron-externo.ps1 -Instalar               registra la tarea 'KuentasVerifactu-Remision' (cada minuto)
#   .\verifactu-cron-externo.ps1 -Desinstalar            elimina la tarea
#   .\verifactu-cron-externo.ps1 -BaseUrl https://...    otro despliegue (por defecto app.kuentas.eu)
#
# Secreto: lee CRON_SECRET del entorno (variable de usuario/maquina que define Ivan).
# NUNCA se pasa por linea de comandos ni se escribe en disco (no queda en el XML de la tarea).
# El endpoint es fail-closed (V24): sin Bearer correcto responde 401 y no procesa nada.

param(
  [switch]$Instalar,
  [switch]$Desinstalar,
  [string]$BaseUrl = 'https://app.kuentas.eu'
)

$ErrorActionPreference = 'Stop'
$TareaNombre = 'KuentasVerifactu-Remision'

if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $TareaNombre -Confirm:$false
  Write-Output "Tarea '$TareaNombre' eliminada."
  return
}

if ($Instalar) {
  if (-not $env:CRON_SECRET) {
    throw "Define antes CRON_SECRET como variable de entorno de usuario/maquina (la tarea la leera de ahi)."
  }
  $scriptPath = $MyInvocation.MyCommand.Path
  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -BaseUrl `"$BaseUrl`""
  $disparo = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)
  $opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
    -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TareaNombre -Action $accion -Trigger $disparo -Settings $opciones `
    -Description "Disparo externo del cron de remision VERI*FACTU de Kuentas (sustituye al cron por minuto de Vercel en plan Hobby)." | Out-Null
  Write-Output "Tarea '$TareaNombre' registrada: cada minuto contra $BaseUrl/api/cron/verifactu-remision"
  return
}

# Ejecucion normal: una llamada al endpoint (equivalente a un tick del cron de Vercel).
if (-not $env:CRON_SECRET) { throw 'CRON_SECRET no esta en el entorno.' }
$respuesta = Invoke-RestMethod -Uri "$BaseUrl/api/cron/verifactu-remision" -Method Get `
  -Headers @{ Authorization = "Bearer $($env:CRON_SECRET)" } -TimeoutSec 90
Write-Output ($respuesta | ConvertTo-Json -Depth 6 -Compress)
