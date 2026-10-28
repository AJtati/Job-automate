$ErrorActionPreference = "Stop"
$AppRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BundledBun = Join-Path $AppRoot "runtime\bun.exe"
$SystemBun = Get-Command bun -ErrorAction SilentlyContinue
$BunExecutable = if (Test-Path $BundledBun) { $BundledBun } elseif ($SystemBun) { $SystemBun.Source } else { $null }
$DefaultDataRoot = if (Test-Path $BundledBun) { Join-Path $env:LOCALAPPDATA "AI Job Search Studio" } else { $AppRoot }
$DataRoot = if ($env:AI_JOB_SEARCH_ROOT) { $env:AI_JOB_SEARCH_ROOT } else { $DefaultDataRoot }
$AppPort = if ($env:AI_JOB_SEARCH_PORT) { $env:AI_JOB_SEARCH_PORT } else { Get-Random -Minimum 41000 -Maximum 49000 }
$InstanceToken = "launcher-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$PID"
$AppUrl = "http://127.0.0.1:$AppPort"

if (-not $BunExecutable) {
    throw "The Bun runtime is missing. Reinstall the portable app, or install Bun from https://bun.sh and retry."
}

$LogDirectory = Join-Path $DataRoot "data"
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
$LogFile = Join-Path $LogDirectory "server.log"
$env:PORT = [string]$AppPort
$env:AI_JOB_SEARCH_APP_ROOT = $AppRoot
$env:AI_JOB_SEARCH_ROOT = $DataRoot
$env:AI_JOB_SEARCH_INSTANCE_TOKEN = $InstanceToken
Start-Process -FilePath $BunExecutable -ArgumentList "run", "app/server.ts" -WorkingDirectory $AppRoot -WindowStyle Hidden -RedirectStandardOutput $LogFile -RedirectStandardError "$LogFile.error"

$running = $false
foreach ($attempt in 1..30) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod "$AppUrl/api/health" -TimeoutSec 1
        if ($health.instanceToken -eq $InstanceToken) { $running = $true; break }
    } catch {}
}
if (-not $running) { throw "The Studio server did not start. Check '$LogFile' and '$LogFile.error', confirm Bun is installed, or set AI_JOB_SEARCH_PORT to a free port." }

# Launch as dedicated standalone desktop window if Edge or Chrome is installed, else default browser
$EdgeCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)
$EdgePath = $EdgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

$ChromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$ChromePath = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($EdgePath) {
    Start-Process -FilePath $EdgePath -ArgumentList "--app=$AppUrl"
} elseif ($ChromePath) {
    Start-Process -FilePath $ChromePath -ArgumentList "--app=$AppUrl"
} else {
    Start-Process $AppUrl
}
