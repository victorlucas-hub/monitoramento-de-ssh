param(
  [string]$MonitorHost = "10.119.8.1",
  [int]$MonitorPort = 22,
  [int]$ConnectTimeoutMs = 3000,
  [int]$WebPort = 3000
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetsFilePath = Join-Path $projectRoot "targets.json"

function Get-ContentType {
  param([string]$FilePath)

  switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

function Write-Response {
  param(
    [Parameter(Mandatory = $true)]$Response,
    [Parameter(Mandatory = $true)][string]$Body,
    [Parameter(Mandatory = $true)][string]$ContentType,
    [int]$StatusCode = 200
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

function Write-FileResponse {
  param(
    [Parameter(Mandatory = $true)]$Response,
    [Parameter(Mandatory = $true)][string]$FilePath
  )

  if (-not (Test-Path $FilePath)) {
    Write-Response -Response $Response -Body "Arquivo nao encontrado." -ContentType "text/plain; charset=utf-8" -StatusCode 404
    return
  }

  $content = [System.IO.File]::ReadAllText($FilePath)
  Write-Response -Response $Response -Body $content -ContentType (Get-ContentType -FilePath $FilePath)
}

function Get-MonitorTargets {
  if (Test-Path $targetsFilePath) {
    try {
      $parsedTargets = Get-Content -Path $targetsFilePath -Raw | ConvertFrom-Json
      if ($parsedTargets -is [System.Array]) {
        $targets = $parsedTargets
      }
      else {
        $targets = @($parsedTargets)
      }

      if ($targets -and $targets.Count -gt 0) {
        $normalized = @()
        foreach ($target in $targets) {
          if (-not $target.host) {
            continue
          }

          $targetName = if ($target.name) { [string]$target.name } else { "Host $($target.host)" }
          $targetPort = if ($target.port) { [int]$target.port } else { $MonitorPort }
          $targetGroup = if ($target.group) { [string]$target.group } else { "PABX" }

          $normalized += [PSCustomObject]@{
            name = $targetName
            host = [string]$target.host
            port = $targetPort
            group = $targetGroup
          }
        }

        if ($normalized.Count -gt 0) {
          return $normalized
        }
      }
    }
    catch {
      Write-Host "Falha ao ler targets.json. Usando alvo padrao." -ForegroundColor Yellow
    }
  }

  return @(
    [PSCustomObject]@{
      name = "Central PABX"
      host = $MonitorHost
      port = $MonitorPort
      group = "PABX"
    }
  )
}

function Save-MonitorTargets {
  param(
    [Parameter(Mandatory = $true)]$Targets
  )

  $json = $Targets | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($targetsFilePath, $json, [System.Text.Encoding]::UTF8)
}

function Read-RequestBody {
  param(
    [Parameter(Mandatory = $true)]$Request
  )

  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Close()
  }
}

function Add-MonitorTarget {
  param(
    [string]$Name,
    [Parameter(Mandatory = $true)][string]$TargetHost,
    [Nullable[int]]$Port,
    [string]$Group
  )

  if ([string]::IsNullOrWhiteSpace($TargetHost)) {
    throw "Host/IP e obrigatorio."
  }

  $portValue = if ($Port) { [int]$Port } else { $MonitorPort }

  if ($portValue -lt 1 -or $portValue -gt 65535) {
    throw "Porta invalida. Use um numero entre 1 e 65535."
  }

  $groupValue = if ([string]::IsNullOrWhiteSpace($Group)) { "PABX" } else { $Group }

  $targets = @(Get-MonitorTargets)
  $exists = $targets | Where-Object {
    $_.host -eq $TargetHost -and [int]$_.port -eq $portValue -and $_.group -eq $groupValue
  }

  if ($exists) {
    return $targets
  }

  $targetName = if ([string]::IsNullOrWhiteSpace($Name)) { "Host $TargetHost" } else { $Name }
  $targets += [PSCustomObject]@{
    name = $targetName
    host = $TargetHost
    port = $portValue
    group = $groupValue
  }

  Save-MonitorTargets -Targets $targets
  return $targets
}

function Update-MonitorTarget {
  param(
    [Parameter(Mandatory = $true)][string]$OriginalHost,
    [Parameter(Mandatory = $true)][int]$OriginalPort,
    [string]$OriginalGroup,
    [string]$Name,
    [Parameter(Mandatory = $true)][string]$TargetHost,
    [Nullable[int]]$Port,
    [string]$Group
  )

  if ([string]::IsNullOrWhiteSpace($TargetHost)) {
    throw "Host/IP e obrigatorio."
  }

  $portValue = if ($Port) { [int]$Port } else { $MonitorPort }
  if ($portValue -lt 1 -or $portValue -gt 65535) {
    throw "Porta invalida. Use um numero entre 1 e 65535."
  }

  $groupValue = if ([string]::IsNullOrWhiteSpace($Group)) { "PABX" } else { $Group }
  $originalGroupValue = if ([string]::IsNullOrWhiteSpace($OriginalGroup)) { "PABX" } else { $OriginalGroup }

  $targets = @(Get-MonitorTargets)
  $targetIndex = -1

  for ($i = 0; $i -lt $targets.Count; $i++) {
    $item = $targets[$i]
    if ($item.host -eq $OriginalHost -and [int]$item.port -eq $OriginalPort -and $item.group -eq $originalGroupValue) {
      $targetIndex = $i
      break
    }
  }

  if ($targetIndex -lt 0) {
    throw "Alvo nao encontrado para edicao."
  }

  $duplicate = $targets | Where-Object {
    $_.host -eq $TargetHost -and [int]$_.port -eq $portValue -and $_.group -eq $groupValue
  }

  if ($duplicate -and -not ($OriginalHost -eq $TargetHost -and $OriginalPort -eq $portValue -and $originalGroupValue -eq $groupValue)) {
    throw "Ja existe um alvo com esse host/porta nesse topico."
  }

  $targetName = if ([string]::IsNullOrWhiteSpace($Name)) { "Host $TargetHost" } else { $Name }
  $targets[$targetIndex] = [PSCustomObject]@{
    name = $targetName
    host = $TargetHost
    port = $portValue
    group = $groupValue
  }

  Save-MonitorTargets -Targets $targets
  return $targets
}

function Remove-MonitorTarget {
  param(
    [Parameter(Mandatory = $true)][string]$TargetHost,
    [Parameter(Mandatory = $true)][int]$Port,
    [string]$Group
  )

  $groupValue = if ([string]::IsNullOrWhiteSpace($Group)) { "PABX" } else { $Group }
  $targets = @(Get-MonitorTargets)

  $filtered = @($targets | Where-Object {
    -not ($_.host -eq $TargetHost -and [int]$_.port -eq $Port -and $_.group -eq $groupValue)
  })

  if ($filtered.Count -eq $targets.Count) {
    throw "Alvo nao encontrado para exclusao."
  }

  Save-MonitorTargets -Targets $filtered
  return $filtered
}

function Test-SshAvailability {
  param(
    [Parameter(Mandatory = $true)]$Target,
    [Parameter(Mandatory = $true)][int]$TimeoutMs
  )

  $startedAt = Get-Date
  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $asyncResult = $client.BeginConnect($Target.host, [int]$Target.port, $null, $null)

    if (-not $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      $client.Close()
      return [PSCustomObject][ordered]@{
        name = $Target.name
        host = $Target.host
        port = [int]$Target.port
        group = $Target.group
        online = $false
        lastCheckedAt = (Get-Date).ToString("o")
        responseTimeMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
        failureReason = "Tempo limite excedido ao conectar na porta."
      }
    }

    $client.EndConnect($asyncResult)
    $client.Close()

    return [PSCustomObject][ordered]@{
      name = $Target.name
      host = $Target.host
      port = [int]$Target.port
      group = $Target.group
      online = $true
      lastCheckedAt = (Get-Date).ToString("o")
      responseTimeMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
      failureReason = $null
    }
  }
  catch {
    $client.Close()

    return [PSCustomObject][ordered]@{
      name = $Target.name
      host = $Target.host
      port = [int]$Target.port
      group = $Target.group
      online = $false
      lastCheckedAt = (Get-Date).ToString("o")
      responseTimeMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
      failureReason = $_.Exception.Message
    }
  }
}

function Get-AllTargetsStatus {
  $targets = Get-MonitorTargets
  $results = @()

  foreach ($target in $targets) {
    if (-not $target.host) {
      continue
    }

    if (-not $target.port) {
      $target | Add-Member -NotePropertyName port -NotePropertyValue $MonitorPort -Force
    }

    if (-not $target.name) {
      $target | Add-Member -NotePropertyName name -NotePropertyValue ("Host " + $target.host) -Force
    }

    $results += Test-SshAvailability -Target $target -TimeoutMs $ConnectTimeoutMs
  }

  $onlineCount = @($results | Where-Object { $_.online }).Count
  $offlineCount = @($results | Where-Object { -not $_.online }).Count

  return [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    totalTargets = $results.Count
    onlineTargets = $onlineCount
    offlineTargets = $offlineCount
    targets = $results
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$WebPort/")
$listener.Start()

$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
Write-Host "Dashboard local:  http://localhost:$WebPort"
if ($localIp) {
    Write-Host "Dashboard na rede: http://${localIp}:$WebPort  <-- compartilhe esse com seu amigo"
}
Write-Host "Targets lidos de targets.json (ou parametro padrao)."
Write-Host "Pressione Ctrl+C para encerrar."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = $context.Request.Url.AbsolutePath

    switch ($requestPath) {
      "/" {
        Write-FileResponse -Response $context.Response -FilePath (Join-Path $projectRoot "public\index.html")
      }
      "/index" {
        Write-FileResponse -Response $context.Response -FilePath (Join-Path $projectRoot "public\index.html")
      }
      "/index.html" {
        Write-FileResponse -Response $context.Response -FilePath (Join-Path $projectRoot "public\index.html")
      }
      "/styles.css" {
        Write-FileResponse -Response $context.Response -FilePath (Join-Path $projectRoot "public\styles.css")
      }
      "/app.js" {
        Write-FileResponse -Response $context.Response -FilePath (Join-Path $projectRoot "public\app.js")
      }
      "/api/targets" {
        if ($context.Request.HttpMethod -eq "GET") {
          $body = [ordered]@{ targets = @(Get-MonitorTargets) } | ConvertTo-Json -Depth 6
          Write-Response -Response $context.Response -Body $body -ContentType "application/json; charset=utf-8"
          break
        }

        if ($context.Request.HttpMethod -eq "POST") {
          try {
            $rawBody = Read-RequestBody -Request $context.Request
            $payload = $rawBody | ConvertFrom-Json

            $name = [string]$payload.name
            $targetHost = [string]$payload.host
            $group = [string]$payload.group
            $port = $null

            if ($null -ne $payload.port -and -not [string]::IsNullOrWhiteSpace([string]$payload.port)) {
              $port = [int]$payload.port
            }

            $targets = Add-MonitorTarget -Name $name -TargetHost $targetHost -Port $port -Group $group
            $body = [ordered]@{
              message = "Alvo salvo com sucesso."
              targets = $targets
            } | ConvertTo-Json -Depth 6

            Write-Response -Response $context.Response -Body $body -ContentType "application/json; charset=utf-8" -StatusCode 201
          }
          catch {
            $errorBody = [ordered]@{ message = $_.Exception.Message } | ConvertTo-Json
            Write-Response -Response $context.Response -Body $errorBody -ContentType "application/json; charset=utf-8" -StatusCode 400
          }

          break
        }

        if ($context.Request.HttpMethod -eq "PUT") {
          try {
            $rawBody = Read-RequestBody -Request $context.Request
            $payload = $rawBody | ConvertFrom-Json

            $name = [string]$payload.name
            $targetHost = [string]$payload.host
            $group = [string]$payload.group
            $originalHost = [string]$payload.originalHost
            $originalGroup = [string]$payload.originalGroup

            if ([string]::IsNullOrWhiteSpace($originalHost)) {
              throw "Host original e obrigatorio."
            }

            if ($null -eq $payload.originalPort) {
              throw "Porta original e obrigatoria."
            }

            $originalPort = [int]$payload.originalPort
            $port = $null
            if ($null -ne $payload.port -and -not [string]::IsNullOrWhiteSpace([string]$payload.port)) {
              $port = [int]$payload.port
            }

            $targets = Update-MonitorTarget -OriginalHost $originalHost -OriginalPort $originalPort -OriginalGroup $originalGroup -Name $name -TargetHost $targetHost -Port $port -Group $group
            $body = [ordered]@{
              message = "Alvo atualizado com sucesso."
              targets = $targets
            } | ConvertTo-Json -Depth 6

            Write-Response -Response $context.Response -Body $body -ContentType "application/json; charset=utf-8" -StatusCode 200
          }
          catch {
            $errorBody = [ordered]@{ message = $_.Exception.Message } | ConvertTo-Json
            Write-Response -Response $context.Response -Body $errorBody -ContentType "application/json; charset=utf-8" -StatusCode 400
          }

          break
        }

        if ($context.Request.HttpMethod -eq "DELETE") {
          try {
            $rawBody = Read-RequestBody -Request $context.Request
            $payload = $rawBody | ConvertFrom-Json

            $hostValue = [string]$payload.host
            $groupValue = [string]$payload.group

            if ([string]::IsNullOrWhiteSpace($hostValue)) {
              throw "Host e obrigatorio para excluir."
            }

            if ($null -eq $payload.port) {
              throw "Porta e obrigatoria para excluir."
            }

            $portValue = [int]$payload.port
            $targets = Remove-MonitorTarget -TargetHost $hostValue -Port $portValue -Group $groupValue
            $body = [ordered]@{
              message = "Alvo removido com sucesso."
              targets = $targets
            } | ConvertTo-Json -Depth 6

            Write-Response -Response $context.Response -Body $body -ContentType "application/json; charset=utf-8" -StatusCode 200
          }
          catch {
            $errorBody = [ordered]@{ message = $_.Exception.Message } | ConvertTo-Json
            Write-Response -Response $context.Response -Body $errorBody -ContentType "application/json; charset=utf-8" -StatusCode 400
          }

          break
        }

        Write-Response -Response $context.Response -Body "Metodo nao permitido." -ContentType "text/plain; charset=utf-8" -StatusCode 405
      }
      "/api/status" {
        $status = Get-AllTargetsStatus
        $json = $status | ConvertTo-Json -Depth 6
        Write-Response -Response $context.Response -Body $json -ContentType "application/json; charset=utf-8"
      }
      default {
        Write-Response -Response $context.Response -Body "Rota nao encontrada." -ContentType "text/plain; charset=utf-8" -StatusCode 404
      }
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
