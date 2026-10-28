#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
PACKAGE_ROOT="$DIST_DIR/AI-Job-Search-Studio-Windows"
ZIP_PATH="$DIST_DIR/AI-Job-Search-Studio-Windows.zip"
CACHE_DIR="$REPO_DIR/.cache"

echo "=========================================================="
echo "🪟 Packaging Portable Windows Distribution for AI Job Search"
echo "=========================================================="

mkdir -p "$DIST_DIR" "$CACHE_DIR"
rm -rf "$PACKAGE_ROOT" "$ZIP_PATH"
mkdir -p "$PACKAGE_ROOT/runtime" "$PACKAGE_ROOT/data"

echo "Copying web application and configuration..."
cp -R "$REPO_DIR/app" "$PACKAGE_ROOT/"
cp -R "$REPO_DIR/bin" "$PACKAGE_ROOT/"
cp "$REPO_DIR/package.json" "$PACKAGE_ROOT/"

# Bundle zero-dependency scraper CLI sources
for SKILL in linkedin-search freehire-search; do
    TARGET="$PACKAGE_ROOT/.agents/skills/$SKILL/cli"
    mkdir -p "$TARGET"
    cp -R "$REPO_DIR/.agents/skills/$SKILL/cli/src" "$TARGET/"
    cp "$REPO_DIR/.agents/skills/$SKILL/cli/package.json" "$TARGET/" 2>/dev/null || true
done

# Bundle clean template data (no personal candidate details or API keys)
cp "$REPO_DIR/data/profiles.template.json" "$PACKAGE_ROOT/data/" 2>/dev/null || true

# Obtain Windows bun.exe runtime
BUN_WIN_ZIP="$CACHE_DIR/bun-windows-x64.zip"
if [ ! -f "$BUN_WIN_ZIP" ]; then
    echo "Downloading latest Windows Bun runtime from GitHub..."
    curl -fsSL "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip" -o "$BUN_WIN_ZIP"
fi

echo "Extracting bun.exe into runtime folder..."
unzip -p "$BUN_WIN_ZIP" "bun-windows-x64/bun.exe" > "$PACKAGE_ROOT/runtime/bun.exe"
chmod +x "$PACKAGE_ROOT/runtime/bun.exe"

# Create 1-click Windows CMD launcher with CRLF line endings
LAUNCHER="$PACKAGE_ROOT/AI Job Search Studio.cmd"
printf "@echo off\r\nsetlocal\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"%%~dp0bin\\launch-app.ps1\"\r\nif errorlevel 1 pause\r\n" > "$LAUNCHER"

echo "Compressing into portable ZIP..."
(cd "$DIST_DIR" && zip -r -q "AI-Job-Search-Studio-Windows.zip" "AI-Job-Search-Studio-Windows")

echo "=========================================================="
echo "🎉 SUCCESS: Windows portable package created!"
echo "📍 Location: $ZIP_PATH"
echo "📦 Contains self-contained bun.exe with standalone window launcher"
echo "=========================================================="
