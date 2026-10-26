$ErrorActionPreference = "Stop"
$AppRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AppPort = if ($env:AI_JOB_SEARCH_PORT) { $env:AI_JOB_SEARCH_PORT } else { "3333" }
$AppUrl = "http://127.0.0.1:$AppPort"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    throw "Bun is required. Install it from https://bun.sh and retry."
}

$running = $false
try { Invoke-WebRequest "$AppUrl/api/jobs" -UseBasicParsing -TimeoutSec 1 | Out-Null; $running = $true } catch {}
if (-not $running) {
    $env:AI_JOB_SEARCH_PORT = $AppPort
    Start-Process -FilePath "bun" -ArgumentList "run", "app/server.ts" -WorkingDirectory $AppRoot -WindowStyle Hidden
    foreach ($attempt in 1..20) {
        Start-Sleep -Milliseconds 250
        try { Invoke-WebRequest "$AppUrl/api/jobs" -UseBasicParsing -TimeoutSec 1 | Out-Null; $running = $true; break } catch {}
    }
}
if (-not $running) { throw "The Studio server did not start. Run 'bun run dev' to see the error." }
Start-Process $AppUrl
