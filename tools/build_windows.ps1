$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DistRoot = Join-Path $RepoRoot "dist"
$PackageRoot = Join-Path $DistRoot "AI-Job-Search-Studio-Windows"
$ZipPath = Join-Path $DistRoot "AI-Job-Search-Studio-Windows.zip"
$BunCommand = Get-Command bun -ErrorAction SilentlyContinue

if (-not $BunCommand) {
    throw "Bun is required to build the Windows package. Install it from https://bun.sh and retry."
}

if (Test-Path $PackageRoot) { Remove-Item $PackageRoot -Recurse -Force }
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PackageRoot "runtime") -Force | Out-Null

Copy-Item (Join-Path $RepoRoot "app") $PackageRoot -Recurse
Copy-Item (Join-Path $RepoRoot "bin") $PackageRoot -Recurse
Copy-Item (Join-Path $RepoRoot "package.json") $PackageRoot
Copy-Item $BunCommand.Source (Join-Path $PackageRoot "runtime\bun.exe")

foreach ($Skill in @("linkedin-search", "freehire-search")) {
    $Source = Join-Path $RepoRoot ".agents\skills\$Skill\cli\src"
    $Target = Join-Path $PackageRoot ".agents\skills\$Skill\cli"
    New-Item -ItemType Directory -Path $Target -Force | Out-Null
    Copy-Item $Source $Target -Recurse
    Copy-Item (Join-Path $RepoRoot ".agents\skills\$Skill\cli\package.json") $Target -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path (Join-Path $PackageRoot "data") -Force | Out-Null
Copy-Item (Join-Path $RepoRoot "data\profiles.template.json") (Join-Path $PackageRoot "data") -ErrorAction SilentlyContinue

$Launcher = Join-Path $PackageRoot "AI Job Search Studio.cmd"
@'
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\launch-app.ps1"
if errorlevel 1 pause
'@ | Set-Content -Path $Launcher -Encoding ASCII

Compress-Archive -Path $PackageRoot -DestinationPath $ZipPath -CompressionLevel Optimal
Write-Host "Windows portable package created at $ZipPath"
Write-Host "It contains Bun and does not contain candidate profiles, API keys, or saved jobs."
