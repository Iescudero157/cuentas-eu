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
#   .\verifactu-cron-externo.ps1 -Instalar               pide y prueba el secreto y registra la tarea
#                                                        'KuentasVerifactu-Remision' (cada minuto).
#                                                        Requiere PowerShell como administrador.
#   .\verifactu-cron-externo.ps1 -Desinstalar            elimina la tarea
#   .\verifactu-cron-externo.ps1 -BaseUrl https://...    otro despliegue (por defecto app.kuentas.eu)
#
# Secreto: el CRON_SECRET de Vercel, guardado en la variable de entorno de usuario
# KUENTAS_CRON_SECRET (nombre propio: en ARES2 ya existe un CRON_SECRET de otra cosa; si
# falta KUENTAS_CRON_SECRET se usa CRON_SECRET). -Instalar lo pide oculto si no esta o no
# vale, lo prueba contra el endpoint y solo entonces lo guarda.
# NUNCA se pasa por linea de comandos ni queda en el XML de la tarea ni en los registros.
# El endpoint es fail-closed (V24): sin Bearer correcto responde 401 y no procesa nada.
#
# La tarea (revisado 1-nov-2026 al instalarla en ARES2):
#  - corre como S4U ("aunque el usuario no haya iniciado sesion", sin guardar contrasena):
#    no abre una ventana cada minuto y sigue con la sesion bloqueada o cerrada. Registrar
#    una tarea S4U exige PowerShell como administrador.
#  - repite sin RepetitionDuration, que equivale a indefinidamente: [TimeSpan]::MaxValue se
#    traduce a P99999999DT23H59M59S y Windows 10/11 lo rechaza ("(8,42):Duration").
#  - ejecuta una copia de este script en %LOCALAPPDATA%\KuentasVerifactu, para no depender
#    del estado del clon de git. En esa carpeta quedan ultima.txt (resultado del ultimo
#    tick), remision-AAAA-MM.log (ticks con actividad) y errores-AAAA-MM.log.

param(
  [switch]$Instalar,
  [switch]$Desinstalar,
  [string]$BaseUrl = 'https://app.kuentas.eu'
)

$ErrorActionPreference = 'Stop'
$TareaNombre = 'KuentasVerifactu-Remision'
$VariableSecreto = 'KUENTAS_CRON_SECRET'
$Endpoint = "$BaseUrl/api/cron/verifactu-remision"
$DirDatos = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'KuentasVerifactu' } else { $PSScriptRoot }

function Get-SecretoCron {
  # Del proceso y, si la tarea arranca sin el bloque de entorno completo, del registro del usuario
  foreach ($nombre in $VariableSecreto, 'CRON_SECRET') {
    foreach ($ambito in 'Process', 'User') {
      $valor = [Environment]::GetEnvironmentVariable($nombre, $ambito)
      if ($valor) { return $valor.Trim() }
    }
  }
  return $null
}

function Invoke-Tick([string]$Secreto) {
  Invoke-RestMethod -Uri $Endpoint -Method Get -Headers @{ Authorization = "Bearer $Secreto" } -TimeoutSec 90
}

# $true si el endpoint acepta el secreto (hace un tick real, igual que la tarea), $false si
# responde 401; cualquier otro fallo (red, 5xx) se propaga
function Test-Secreto([string]$Secreto) {
  if (-not $Secreto) { return $false }
  try { $null = Invoke-Tick $Secreto; return $true }
  catch {
    $respuesta = $_.Exception.Response
    if ($respuesta -and [int]$respuesta.StatusCode -eq 401) { return $false }
    throw
  }
}

if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $TareaNombre -Confirm:$false
  Write-Output "Tarea '$TareaNombre' eliminada. Quedan la variable $VariableSecreto y la carpeta $DirDatos."
  return
}

if ($Instalar) {
  $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
  $esAdmin = ([Security.Principal.WindowsPrincipal]$identidad).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $esAdmin) {
    throw 'Abre PowerShell como administrador: la tarea se registra para correr sin ventana (S4U) y eso lo exige.'
  }

  $secreto = [Environment]::GetEnvironmentVariable($VariableSecreto, 'User')
  if ($secreto) { $secreto = $secreto.Trim() }
  $guardar = $false
  if (-not (Test-Secreto $secreto)) {
    if ($secreto) { Write-Output "El $VariableSecreto guardado no vale (401): hay que pegarlo de nuevo." }
    $seguro = Read-Host 'Pega el CRON_SECRET de Vercel (no se vera al pegarlo) y pulsa Intro' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
    try { $secreto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if (-not (Test-Secreto $secreto)) {
      throw "Ese valor no es el CRON_SECRET de Vercel ($Endpoint responde 401). No se ha guardado ni instalado nada."
    }
    $guardar = $true
  }
  if ($guardar) {
    [Environment]::SetEnvironmentVariable($VariableSecreto, $secreto, 'User')
    Write-Output "Secreto correcto: guardado en la variable de usuario $VariableSecreto."
  } else {
    Write-Output "El $VariableSecreto guardado es correcto."
  }
  $secreto = $null

  New-Item -ItemType Directory -Force -Path $DirDatos | Out-Null
  $copia = Join-Path $DirDatos 'verifactu-cron-externo.ps1'
  if ($MyInvocation.MyCommand.Path -ne $copia) {
    Copy-Item -LiteralPath $MyInvocation.MyCommand.Path -Destination $copia -Force
  }

  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$copia`" -BaseUrl `"$BaseUrl`""
  $disparo = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
  $opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
    -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $principal = New-ScheduledTaskPrincipal -UserId $identidad.Name -LogonType S4U -RunLevel Limited
  Register-ScheduledTask -TaskName $TareaNombre -Action $accion -Trigger $disparo -Settings $opciones `
    -Principal $principal -Force `
    -Description "Disparo externo del cron de remision VERI*FACTU de Kuentas (sustituye al cron por minuto de Vercel en plan Hobby)." | Out-Null
  Write-Output "Tarea '$TareaNombre' registrada: cada minuto, sin ventana, contra $Endpoint"

  # Primer tick ya, ejecutado por el Programador de tareas (mismo entorno que los siguientes)
  $antes = (Get-ScheduledTaskInfo -TaskName $TareaNombre).LastRunTime
  Start-ScheduledTask -TaskName $TareaNombre
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    $info = Get-ScheduledTaskInfo -TaskName $TareaNombre
    if ($info.LastRunTime -ne $antes -and (Get-ScheduledTask -TaskName $TareaNombre).State -ne 'Running') { break }
  }
  $info = Get-ScheduledTaskInfo -TaskName $TareaNombre
  $ultima = Join-Path $DirDatos 'ultima.txt'
  Write-Output "Primer tick desde el Programador: resultado $($info.LastTaskResult) (0 = correcto)."
  if (Test-Path -LiteralPath $ultima) { Write-Output ('ultima.txt: ' + (Get-Content -LiteralPath $ultima -Raw).Trim()) }
  return
}

# Ejecucion normal: una llamada al endpoint (equivalente a un tick del cron de Vercel).
New-Item -ItemType Directory -Force -Path $DirDatos | Out-Null
$mes = Get-Date -Format 'yyyy-MM'
$ahora = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
try {
  $secreto = Get-SecretoCron
  if (-not $secreto) { throw "Falta $VariableSecreto en el entorno del usuario." }
  $respuesta = Invoke-Tick $secreto
} catch {
  $linea = "$ahora ERROR $($_.Exception.Message)"
  Set-Content -LiteralPath (Join-Path $DirDatos 'ultima.txt') -Value $linea -Encoding UTF8
  Add-Content -LiteralPath (Join-Path $DirDatos "errores-$mes.log") -Value $linea -Encoding UTF8
  throw
}
$json = $respuesta | ConvertTo-Json -Depth 6 -Compress
if ($respuesta.procesado) {
  $linea = "$ahora OK enviados=$($respuesta.totalEnviados) errores=$($respuesta.totalErrores) omitidos=$($respuesta.totalOmitidos)"
  $actividad = $respuesta.totalEnviados -or $respuesta.totalErrores -or $respuesta.totalOmitidos
} else {
  $linea = "$ahora SIN PROCESAR $($respuesta.motivo)"
  $actividad = $true
}
Set-Content -LiteralPath (Join-Path $DirDatos 'ultima.txt') -Value $linea -Encoding UTF8
if ($actividad) { Add-Content -LiteralPath (Join-Path $DirDatos "remision-$mes.log") -Value "$linea $json" -Encoding UTF8 }
Write-Output $json
