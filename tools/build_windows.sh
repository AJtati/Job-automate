#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
PACKAGE_ROOT="$DIST_DIR/AI-Job-Search-Studio-Windows"
ZIP_PATH="$DIST_DIR/AI-Job-Search-Studio-Windows.zip"
CACHE_DIR="$REPO_DIR/.cache/windows-runtime"
BUN_VERSION="1.3.10"
TECTONIC_VERSION="0.17.0"
BUN_SHA256="7a77b3e245e2e26965c93089a4a1332e8a326d3364c89fae1d1fd99cdd3cd73d"
TECTONIC_WINDOWS_SHA256="f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f"
BUN_HOST="$(command -v bun || true)"

if [[ -z "$BUN_HOST" ]]; then
    echo "Bun is required to build this package." >&2
    exit 1
fi

sha256() {
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    else
        sha256sum "$1" | awk '{print $1}'
    fi
}

download_verified() {
    local url="$1"
    local path="$2"
    local expected="$3"
    mkdir -p "$(dirname "$path")"
    if [[ ! -f "$path" ]] || [[ "$(sha256 "$path")" != "$expected" ]]; then
        rm -f "$path"
        curl -fsSL --retry 3 "$url" -o "$path"
    fi
    local actual
    actual="$(sha256 "$path")"
    if [[ "$actual" != "$expected" ]]; then
        rm -f "$path"
        echo "SHA-256 verification failed for $path" >&2
        exit 1
    fi
}

case "$(uname -s):$(uname -m)" in
    Darwin:arm64)
        HOST_TECTONIC_NAME="tectonic-0.17.0-aarch64-apple-darwin.tar.gz"
        HOST_TECTONIC_SHA256="a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667"
        ;;
    Darwin:x86_64)
        HOST_TECTONIC_NAME="tectonic-0.17.0-x86_64-apple-darwin.tar.gz"
        HOST_TECTONIC_SHA256="7c90ef5b6ddb1eb1937e4337add5237b79338e4b9676459fa91187d24d6cdf80"
        ;;
    Linux:x86_64)
        HOST_TECTONIC_NAME="tectonic-0.17.0-x86_64-unknown-linux-gnu.tar.gz"
        HOST_TECTONIC_SHA256="1a715688baf591e650c8aeb160ae934e181685eecbb38b317de30b269ac5d606"
        ;;
    *)
        echo "Windows packaging from this host is supported on macOS ARM/Intel and Linux x64." >&2
        exit 1
        ;;
esac

echo "Preparing portable Windows distribution..."
rm -rf "$PACKAGE_ROOT" "$ZIP_PATH"
mkdir -p "$PACKAGE_ROOT/runtime" "$PACKAGE_ROOT/bin" "$PACKAGE_ROOT/node_modules" "$CACHE_DIR"

(
    cd "$REPO_DIR"
    "$BUN_HOST" install --frozen-lockfile
)

BUN_ZIP="$CACHE_DIR/bun-windows-x64.zip"
download_verified \
    "https://github.com/oven-sh/bun/releases/download/bun-v$BUN_VERSION/bun-windows-x64.zip" \
    "$BUN_ZIP" \
    "$BUN_SHA256"
BUN_MEMBER="$(unzip -Z1 "$BUN_ZIP" | awk -F/ '$NF == "bun.exe" { print; exit }')"
if [[ -z "$BUN_MEMBER" ]]; then
    echo "The Bun release archive did not contain bun.exe." >&2
    exit 1
fi
unzip -p "$BUN_ZIP" "$BUN_MEMBER" > "$PACKAGE_ROOT/runtime/bun.exe"

TECTONIC_WINDOWS_ZIP="$CACHE_DIR/tectonic-windows-x64.zip"
download_verified \
    "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip" \
    "$TECTONIC_WINDOWS_ZIP" \
    "$TECTONIC_WINDOWS_SHA256"
TECTONIC_MEMBER="$(unzip -Z1 "$TECTONIC_WINDOWS_ZIP" | awk -F/ '$NF == "tectonic.exe" { print; exit }')"
if [[ -z "$TECTONIC_MEMBER" ]]; then
    echo "The Tectonic release archive did not contain tectonic.exe." >&2
    exit 1
fi
unzip -p "$TECTONIC_WINDOWS_ZIP" "$TECTONIC_MEMBER" > "$PACKAGE_ROOT/bin/tectonic.exe"

HOST_TECTONIC_ARCHIVE="$CACHE_DIR/$HOST_TECTONIC_NAME"
download_verified \
    "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/$HOST_TECTONIC_NAME" \
    "$HOST_TECTONIC_ARCHIVE" \
    "$HOST_TECTONIC_SHA256"
HOST_TECTONIC_DIR="$CACHE_DIR/host-tectonic"
rm -rf "$HOST_TECTONIC_DIR"
mkdir -p "$HOST_TECTONIC_DIR"
tar -xzf "$HOST_TECTONIC_ARCHIVE" -C "$HOST_TECTONIC_DIR"
HOST_TECTONIC="$(find "$HOST_TECTONIC_DIR" -type f -name tectonic -print -quit)"
if [[ -z "$HOST_TECTONIC" ]]; then
    echo "The host Tectonic archive did not contain the tectonic executable." >&2
    exit 1
fi

cp -R "$REPO_DIR/app" "$PACKAGE_ROOT/"
rm -rf "$PACKAGE_ROOT/app/tests"
cp "$REPO_DIR/bin/launch-app.ps1" "$PACKAGE_ROOT/bin/"
cp "$REPO_DIR/package.json" "$REPO_DIR/bun.lock" "$PACKAGE_ROOT/"
cp -R "$REPO_DIR/node_modules/pdfjs-dist" "$PACKAGE_ROOT/node_modules/"
mkdir -p "$PACKAGE_ROOT/tools"
cp "$REPO_DIR/tools/scrape_jobspy.py" "$PACKAGE_ROOT/tools/"

for SKILL in linkedin-search freehire-search; do
    TARGET="$PACKAGE_ROOT/.agents/skills/$SKILL/cli"
    mkdir -p "$TARGET"
    cp -R "$REPO_DIR/.agents/skills/$SKILL/cli/src" "$TARGET/"
    cp "$REPO_DIR/.agents/skills/$SKILL/cli/package.json" "$TARGET/" 2>/dev/null || true
done

mkdir -p "$PACKAGE_ROOT/data"
cp "$REPO_DIR/data/profiles.template.json" "$PACKAGE_ROOT/data/" 2>/dev/null || true
cp "$REPO_DIR/data/taxonomy_knowledge.json" "$PACKAGE_ROOT/data/" 2>/dev/null || true

"$BUN_HOST" run "$REPO_DIR/tools/prepare_tectonic_cache.ts" \
    "$HOST_TECTONIC" \
    "$PACKAGE_ROOT/runtime/tectonic-cache/bundles"

printf "@echo off\r\nsetlocal\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"%%~dp0bin\\launch-app.ps1\"\r\nif errorlevel 1 pause\r\n" \
    > "$PACKAGE_ROOT/AI Job Search Studio.cmd"

(cd "$DIST_DIR" && zip -qr "AI-Job-Search-Studio-Windows.zip" "AI-Job-Search-Studio-Windows")
echo "Portable Windows package created at $ZIP_PATH"
echo "It includes Bun, PDF.js, the Windows Tectonic binary, and offline LaTeX resources."
echo "Run tools/build_windows.ps1 on Windows with Inno Setup 6 to create the installer EXE."
