$scriptPath = $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($scriptPath)) {
  $projectRoot = (Get-Location).Path
} else {
  $projectRoot = Split-Path -Parent $scriptPath
}

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  (Join-Path $projectRoot 'server.ps1')
)

Start-Sleep -Seconds 2
Start-Process 'http://localhost:3000/index'