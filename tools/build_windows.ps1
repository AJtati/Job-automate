$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DistRoot = Join-Path $RepoRoot "dist"
$PackageRoot = Join-Path $DistRoot "AI-Job-Search-Studio-Windows"
$ZipPath = Join-Path $DistRoot "AI-Job-Search-Studio-Windows.zip"
$CacheRoot = Join-Path $RepoRoot ".cache\windows-runtime"
$BunVersion = "1.3.10"
$TectonicVersion = "0.17.0"
$BunSha256 = "7a77b3e245e2e26965c93089a4a1332e8a326d3364c89fae1d1fd99cdd3cd73d"
$TectonicSha256 = "f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f"
$BunCommand = Get-Command bun -ErrorAction SilentlyContinue

if (-not $BunCommand) {
    throw "Bun is required to build the Windows package. Install Bun and retry."
}

function Get-VerifiedAsset([string]$Url, [string]$Path, [string]$ExpectedSha256) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
    if (-not (Test-Path $Path)) {
        Invoke-WebRequest -Uri $Url -OutFile $Path
    }
    $ActualSha256 = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ActualSha256 -ne $ExpectedSha256) {
        Remove-Item $Path -Force -ErrorAction SilentlyContinue
        throw "SHA-256 verification failed for $Path."
    }
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
New-Item -ItemType Directory -Path $DistRoot, $CacheRoot -Force | Out-Null
if (Test-Path $PackageRoot) { Remove-Item $PackageRoot -Recurse -Force }
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PackageRoot "runtime") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PackageRoot "bin") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PackageRoot "node_modules\pdfjs-dist") -Force | Out-Null

Push-Location $RepoRoot
try {
    & $BunCommand.Source install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "Could not install the locked build dependencies." }
} finally {
    Pop-Location
}

$BunZip = Join-Path $CacheRoot "bun-windows-x64.zip"
$TectonicZip = Join-Path $CacheRoot "tectonic-windows-x64.zip"
Get-VerifiedAsset "https://github.com/oven-sh/bun/releases/download/bun-v$BunVersion/bun-windows-x64.zip" $BunZip $BunSha256
Get-VerifiedAsset "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400$TectonicVersion/tectonic-$TectonicVersion-x86_64-pc-windows-msvc.zip" $TectonicZip $TectonicSha256

$BunExtract = Join-Path $CacheRoot "bun-extracted"
$TectonicExtract = Join-Path $CacheRoot "tectonic-extracted"
Remove-Item $BunExtract, $TectonicExtract -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $BunZip -DestinationPath $BunExtract -Force
Expand-Archive -Path $TectonicZip -DestinationPath $TectonicExtract -Force
$BundledBun = Get-ChildItem -Path $BunExtract -Filter "bun.exe" -File -Recurse | Select-Object -First 1
$BundledTectonic = Get-ChildItem -Path $TectonicExtract -Filter "tectonic.exe" -File -Recurse | Select-Object -First 1
if (-not $BundledBun -or -not $BundledTectonic) {
    throw "The downloaded Windows runtimes did not contain bun.exe and tectonic.exe."
}
Copy-Item $BundledBun.FullName (Join-Path $PackageRoot "runtime\bun.exe")
Copy-Item $BundledTectonic.FullName (Join-Path $PackageRoot "bin\tectonic.exe")

Copy-Item (Join-Path $RepoRoot "app") $PackageRoot -Recurse
Remove-Item (Join-Path $PackageRoot "app\tests") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $RepoRoot "bin\launch-app.ps1") (Join-Path $PackageRoot "bin")
Copy-Item (Join-Path $RepoRoot "package.json") $PackageRoot
Copy-Item (Join-Path $RepoRoot "bun.lock") $PackageRoot
Copy-Item (Join-Path $RepoRoot "node_modules\pdfjs-dist\*") (Join-Path $PackageRoot "node_modules\pdfjs-dist") -Recurse
New-Item -ItemType Directory -Path (Join-Path $PackageRoot "tools") -Force | Out-Null
Copy-Item (Join-Path $RepoRoot "tools\scrape_jobspy.py") (Join-Path $PackageRoot "tools") -ErrorAction SilentlyContinue

foreach ($Skill in @("linkedin-search", "freehire-search")) {
    $Source = Join-Path $RepoRoot ".agents\skills\$Skill\cli\src"
    $Target = Join-Path $PackageRoot ".agents\skills\$Skill\cli"
    New-Item -ItemType Directory -Path $Target -Force | Out-Null
    Copy-Item $Source $Target -Recurse
    Copy-Item (Join-Path $RepoRoot ".agents\skills\$Skill\cli\package.json") $Target -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path (Join-Path $PackageRoot "data") -Force | Out-Null
Copy-Item (Join-Path $RepoRoot "data\profiles.template.json") (Join-Path $PackageRoot "data") -ErrorAction SilentlyContinue
Copy-Item (Join-Path $RepoRoot "data\taxonomy_knowledge.json") (Join-Path $PackageRoot "data") -ErrorAction SilentlyContinue

$CacheBundles = Join-Path $PackageRoot "runtime\tectonic-cache\bundles"
Push-Location $RepoRoot
try {
    & $BunCommand.Source run tools/prepare_tectonic_cache.ts (Join-Path $PackageRoot "bin\tectonic.exe") $CacheBundles
    if ($LASTEXITCODE -ne 0) { throw "Could not prepare the offline LaTeX support bundle." }
} finally {
    Pop-Location
}

$Launcher = Join-Path $PackageRoot "AI Job Search Studio.cmd"
@'
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\launch-app.ps1"
if errorlevel 1 pause
'@ | Set-Content -Path $Launcher -Encoding ASCII

Compress-Archive -Path $PackageRoot -DestinationPath $ZipPath -CompressionLevel Optimal
Write-Host "Windows portable package created at $ZipPath"

$Iscc = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
$IsccPath = $null
if ($Iscc) {
    $IsccPath = $Iscc.Source
} else {
    $ProgramFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
    $KnownIscc = Join-Path $ProgramFilesX86 "Inno Setup 6\ISCC.exe"
    if (Test-Path $KnownIscc) { $IsccPath = $KnownIscc }
}

if ($IsccPath) {
    & $IsccPath (Join-Path $RepoRoot "tools\windows-installer.iss") "/DPackageDir=$PackageRoot" "/DOutputDir=$DistRoot"
    if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed to create the Windows installer." }
    Write-Host ("Windows installer created at " + (Join-Path $DistRoot "AI-Job-Search-Studio-Setup.exe"))
} else {
    Write-Warning "Install Inno Setup 6 to also create AI-Job-Search-Studio-Setup.exe. The portable ZIP is ready."
}

Write-Host "The package bundles Bun, PDF.js, Windows Tectonic, and cached LaTeX resources."
Write-Host "It contains no candidate profiles, API keys, or saved job data."
