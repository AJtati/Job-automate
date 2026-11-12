#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
APP_NAME="AI Job Search Studio"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
DMG_PATH="$DIST_DIR/AI-Job-Search-Studio.dmg"
NEW_DMG="$DIST_DIR/AI-Job-Search-Studio.new.dmg"
STAGING_DIR="$DIST_DIR/dmg_staging"
PREVIOUS_APP="$DIST_DIR/.AI Job Search Studio.previous.app"
PREVIOUS_DMG="$DIST_DIR/.AI-Job-Search-Studio.previous.dmg"
BUN_VERSION="1.3.10"
TECTONIC_VERSION="0.17.0"
MACOS_MIN_VERSION="13.0"
BUILD_SUCCEEDED=0

echo "=========================================================="
echo "🍏 Building Native macOS Cocoa .app & DMG for AI Job Search"
echo "=========================================================="

cleanup_build() {
    local status="$?"
    set +e
    if [ "$BUILD_SUCCEEDED" -eq 1 ]; then
        rm -rf "$PREVIOUS_APP" "$PREVIOUS_DMG"
    else
        rm -rf "$APP_BUNDLE" "$NEW_DMG" "$DIST_DIR/dmg_staging"
        if [ -d "$PREVIOUS_APP" ]; then mv "$PREVIOUS_APP" "$APP_BUNDLE"; fi
        if [ -f "$PREVIOUS_DMG" ]; then mv "$PREVIOUS_DMG" "$DMG_PATH"; fi
    fi
    exit "$status"
}
trap cleanup_build EXIT

mkdir -p "$DIST_DIR"
rm -rf "$STAGING_DIR" "$DIST_DIR/AppIcon.iconset" "$DIST_DIR/runtime-downloads"
rm -f "$NEW_DMG" "$DIST_DIR/temp_rw.dmg" "$DIST_DIR/generate_icon" "$DIST_DIR/generate_icon.swift" \
    "$DIST_DIR/icon_1024.png" "$DIST_DIR/generate_dmg_background" "$DIST_DIR/dmg_background.tiff" "$DIST_DIR/dmg_background.png"
if [ -e "$PREVIOUS_APP" ] || [ -e "$PREVIOUS_DMG" ]; then
    echo "A previous interrupted build needs recovery before another DMG build." >&2
    exit 1
fi
if [ -d "$APP_BUNDLE" ]; then
    mv "$APP_BUNDLE" "$PREVIOUS_APP"
fi
mkdir -p "$STAGING_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# 1. Create Info.plist with native executable and Dock presence
cat <<EOF > "$APP_BUNDLE/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>AI Job Search Studio</string>
    <key>CFBundleExecutable</key>
    <string>AI Job Search Studio</string>
    <key>CFBundleIconFile</key>
    <string>app.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.aijobsearch.studio</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>AI Job Search Studio</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
</dict>
</plist>
EOF

echo "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"

# 2. Compile native Swift Cocoa binary with WebKit and real Dock integration
echo "Compiling native Swift binary..."
swiftc -target "arm64-apple-macosx$MACOS_MIN_VERSION" -O -framework Cocoa -framework WebKit \
    "$REPO_DIR/native_app/main.swift" -o "$DIST_DIR/AI Job Search Studio.arm64"
swiftc -target "x86_64-apple-macosx$MACOS_MIN_VERSION" -O -framework Cocoa -framework WebKit \
    "$REPO_DIR/native_app/main.swift" -o "$DIST_DIR/AI Job Search Studio.x86_64"
lipo -create "$DIST_DIR/AI Job Search Studio.arm64" "$DIST_DIR/AI Job Search Studio.x86_64" \
    -output "$APP_BUNDLE/Contents/MacOS/AI Job Search Studio"
rm -f "$DIST_DIR/AI Job Search Studio.arm64" "$DIST_DIR/AI Job Search Studio.x86_64"

chmod +x "$APP_BUNDLE/Contents/MacOS/AI Job Search Studio"

# 3. Create high-resolution macOS ICNS icon
ICONSET_DIR="$DIST_DIR/AppIcon.iconset"
mkdir -p "$ICONSET_DIR"

cat <<'SWIFTEOF' > "$DIST_DIR/generate_icon.swift"
import Cocoa

let size = NSSize(width: 1024, height: 1024)
let img = NSImage(size: size)
img.lockFocus()

let rect = NSRect(origin: .zero, size: size)
let roundedPath = NSBezierPath(roundedRect: rect.insetBy(dx: 40, dy: 40), xRadius: 220, yRadius: 220)

// Rich Apple gradient
let gradient = NSGradient(colors: [
    NSColor(red: 0.05, green: 0.12, blue: 0.28, alpha: 1.0),
    NSColor(red: 0.04, green: 0.52, blue: 1.0, alpha: 1.0)
])
gradient?.draw(in: roundedPath, angle: -45)

// Outer border
NSColor(white: 1.0, alpha: 0.25).setStroke()
roundedPath.lineWidth = 12
roundedPath.stroke()

// Text / Symbol
let font = NSFont.systemFont(ofSize: 420, weight: .bold)
let text = "⚡" as NSString
let attr: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.white
]
let textSize = text.size(withAttributes: attr)
let textOrigin = NSPoint(x: (size.width - textSize.width) / 2, y: (size.height - textSize.height) / 2 - 20)
text.draw(at: textOrigin, withAttributes: attr)

img.unlockFocus()

if let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) {
    let pngData = rep.representation(using: .png, properties: [:])
    try? pngData?.write(to: URL(fileURLWithPath: "dist/icon_1024.png"))
}
SWIFTEOF

swiftc -O -framework Cocoa "$DIST_DIR/generate_icon.swift" -o "$DIST_DIR/generate_icon"
(cd "$REPO_DIR" && "$DIST_DIR/generate_icon")
rm "$DIST_DIR/generate_icon"
rm "$DIST_DIR/generate_icon.swift"

if [ -f "$DIST_DIR/icon_1024.png" ]; then
    sips -z 16 16     "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
    sips -z 32 32     "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
    sips -z 32 32     "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
    sips -z 64 64     "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
    sips -z 128 128   "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
    sips -z 256 256   "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
    sips -z 256 256   "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
    sips -z 512 512   "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
    sips -z 512 512   "$DIST_DIR/icon_1024.png" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
    cp "$DIST_DIR/icon_1024.png" "$ICONSET_DIR/icon_512x512@2x.png"

    iconutil -c icns "$ICONSET_DIR" -o "$APP_BUNDLE/Contents/Resources/app.icns"
    rm -rf "$ICONSET_DIR" "$DIST_DIR/icon_1024.png"
fi

# 3.5 Bundle web app code and assets into Resources for standalone execution
echo "Bundling web app resources into .app bundle..."
APP_RESOURCES="$APP_BUNDLE/Contents/Resources"
BUN_HOST="$(command -v bun 2>/dev/null || true)"
if [ -z "$BUN_HOST" ] || [ ! -x "$BUN_HOST" ]; then
    echo "Bun is required on the build machine to prepare the packaged app." >&2
    exit 1
fi
(
    cd "$REPO_DIR"
    "$BUN_HOST" install --frozen-lockfile
)

download_verified() {
    local url="$1"
    local path="$2"
    local expected="$3"
    curl -fsSL --retry 3 "$url" -o "$path"
    local actual
    actual="$(shasum -a 256 "$path" | awk '{print $1}')"
    if [ "$actual" != "$expected" ]; then
        rm -f "$path"
        echo "SHA-256 verification failed for $path" >&2
        exit 1
    fi
}

mkdir -p "$DIST_DIR/runtime-downloads" "$APP_RESOURCES/bin" "$APP_RESOURCES/runtime"
BUN_ARM_ZIP="$DIST_DIR/runtime-downloads/bun-darwin-aarch64.zip"
BUN_X64_ZIP="$DIST_DIR/runtime-downloads/bun-darwin-x64.zip"
download_verified \
    "https://github.com/oven-sh/bun/releases/download/bun-v$BUN_VERSION/bun-darwin-aarch64.zip" \
    "$BUN_ARM_ZIP" \
    "82034e87c9d9b4398ea619aee2eed5d2a68c8157e9a6ae2d1052d84d533ccd8d"
download_verified \
    "https://github.com/oven-sh/bun/releases/download/bun-v$BUN_VERSION/bun-darwin-x64.zip" \
    "$BUN_X64_ZIP" \
    "c1d90bf6140f20e572c473065dc6b37a4b036349b5e9e4133779cc642ad94323"

BUN_ARM_MEMBER="bun-darwin-aarch64/bun"
BUN_X64_MEMBER="bun-darwin-x64/bun"
if ! unzip -Z1 "$BUN_ARM_ZIP" | grep -Fxq "$BUN_ARM_MEMBER" || ! unzip -Z1 "$BUN_X64_ZIP" | grep -Fxq "$BUN_X64_MEMBER"; then
    echo "A Bun release archive did not contain the expected runtime." >&2
    exit 1
fi
unzip -p "$BUN_ARM_ZIP" "$BUN_ARM_MEMBER" > "$DIST_DIR/runtime-downloads/bun-arm64"
unzip -p "$BUN_X64_ZIP" "$BUN_X64_MEMBER" > "$DIST_DIR/runtime-downloads/bun-x64"
lipo -create "$DIST_DIR/runtime-downloads/bun-arm64" "$DIST_DIR/runtime-downloads/bun-x64" -output "$APP_RESOURCES/bin/bun"
chmod +x "$APP_RESOURCES/bin/bun"

TECTONIC_ARM_ARCHIVE="$DIST_DIR/runtime-downloads/tectonic-arm64.tar.gz"
TECTONIC_X64_ARCHIVE="$DIST_DIR/runtime-downloads/tectonic-x64.tar.gz"
download_verified \
    "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$TECTONIC_VERSION/tectonic-$TECTONIC_VERSION-aarch64-apple-darwin.tar.gz" \
    "$TECTONIC_ARM_ARCHIVE" \
    "a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667"
download_verified \
    "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$TECTONIC_VERSION/tectonic-$TECTONIC_VERSION-x86_64-apple-darwin.tar.gz" \
    "$TECTONIC_X64_ARCHIVE" \
    "7c90ef5b6ddb1eb1937e4337add5237b79338e4b9676459fa91187d24d6cdf80"
mkdir -p "$DIST_DIR/runtime-downloads/tectonic-arm64" "$DIST_DIR/runtime-downloads/tectonic-x64"
tar -xzf "$TECTONIC_ARM_ARCHIVE" -C "$DIST_DIR/runtime-downloads/tectonic-arm64"
tar -xzf "$TECTONIC_X64_ARCHIVE" -C "$DIST_DIR/runtime-downloads/tectonic-x64"
TECTONIC_ARM_BIN="$(find "$DIST_DIR/runtime-downloads/tectonic-arm64" -type f -name tectonic -print -quit)"
TECTONIC_X64_BIN="$(find "$DIST_DIR/runtime-downloads/tectonic-x64" -type f -name tectonic -print -quit)"
if [ -z "$TECTONIC_ARM_BIN" ] || [ -z "$TECTONIC_X64_BIN" ]; then
    echo "A Tectonic release archive did not contain the expected executable." >&2
    exit 1
fi
lipo -create "$TECTONIC_ARM_BIN" "$TECTONIC_X64_BIN" -output "$APP_RESOURCES/bin/tectonic"
chmod +x "$APP_RESOURCES/bin/tectonic"

ARCHS="$(lipo -archs "$APP_RESOURCES/bin/bun")"
if [[ "$ARCHS" != *arm64* || "$ARCHS" != *x86_64* ]]; then
    echo "The packaged Bun runtime is not universal: $ARCHS" >&2
    exit 1
fi
ARCHS="$(lipo -archs "$APP_RESOURCES/bin/tectonic")"
if [[ "$ARCHS" != *arm64* || "$ARCHS" != *x86_64* ]]; then
    echo "The packaged Tectonic runtime is not universal: $ARCHS" >&2
    exit 1
fi

cp -R "$REPO_DIR/app" "$APP_RESOURCES/"
rm -rf "$APP_RESOURCES/app/tests"
cp "$REPO_DIR/package.json" "$REPO_DIR/bun.lock" "$APP_RESOURCES/"
mkdir -p "$APP_RESOURCES/node_modules"
cp -R "$REPO_DIR/node_modules/pdfjs-dist" "$APP_RESOURCES/node_modules/"

# Bundle the exact zero-dependency scraper sources used by the server. Do not
# package node_modules or any local candidate/job data.
for SKILL_DIR in "$REPO_DIR"/.agents/skills/*; do
    if [ -d "$SKILL_DIR/cli" ]; then
        SKILL="$(basename "$SKILL_DIR")"
        TARGET="$APP_BUNDLE/Contents/Resources/.agents/skills/$SKILL/cli"
        mkdir -p "$TARGET"
        cp -R "$SKILL_DIR/cli/src" "$TARGET/" 2>/dev/null || true
        cp "$SKILL_DIR/cli/package.json" "$TARGET/" 2>/dev/null || true
    fi
done

# Bundle clean template data and public sponsor register without any personal candidate data
mkdir -p "$APP_RESOURCES/data"
cp "$REPO_DIR/data/profiles.template.json" "$APP_RESOURCES/data/" 2>/dev/null || true
cp "$REPO_DIR/data/sponsor_register.json" "$APP_RESOURCES/data/" 2>/dev/null || true
cp "$REPO_DIR/data/new_sponsors.json" "$APP_RESOURCES/data/" 2>/dev/null || true
cp "$REPO_DIR/data/taxonomy_knowledge.json" "$APP_RESOURCES/data/" 2>/dev/null || true

# Bundle lightweight tools needed by the app at runtime
mkdir -p "$APP_RESOURCES/tools"
cp "$REPO_DIR/tools/scrape_jobspy.py" "$APP_RESOURCES/tools/" 2>/dev/null || true

"$BUN_HOST" run "$REPO_DIR/tools/prepare_tectonic_cache.ts" \
    "$APP_RESOURCES/bin/tectonic" \
    "$APP_RESOURCES/runtime/tectonic-cache/bundles"

# 4. Generate Apple-designed retina DMG background (Multi-Resolution HiDPI TIFF)
echo "Generating Apple-designed retina DMG background..."
swiftc -O -framework Cocoa "$REPO_DIR/tools/generate_dmg_background.swift" -o "$DIST_DIR/generate_dmg_background"
"$DIST_DIR/generate_dmg_background" "$DIST_DIR/dmg_background.tiff"
rm -f "$DIST_DIR/generate_dmg_background"

# 5. Build Styled macOS DMG Package using Native Finder AppleScript
echo "Creating styled macOS DMG installer..."
TMP_DMG="$DIST_DIR/temp_rw.dmg"
rm -f "$TMP_DMG"
hdiutil detach "/Volumes/$APP_NAME" 2>/dev/null || true

# Prepare staging
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/.background"
cp -R "$APP_BUNDLE" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"
cp "$DIST_DIR/dmg_background.tiff" "$STAGING_DIR/.background/dmg_background.tiff"
cp "$DIST_DIR/dmg_background.png" "$STAGING_DIR/.background/dmg_background.png"

# Calculate size needed
APP_SIZE_MB=$(du -sm "$APP_BUNDLE" | cut -f1)
DMG_SIZE_MB=$((APP_SIZE_MB + 50))

echo "Creating writable disk image (${DMG_SIZE_MB}MB)..."
hdiutil create -srcfolder "$STAGING_DIR" -size "${DMG_SIZE_MB}m" -volname "$APP_NAME" -fs HFS+ -format UDRW -ov "$TMP_DMG"
rm -rf "$STAGING_DIR"

echo "Mounting writable disk image..."
DEV=$(hdiutil attach "$TMP_DMG" -readwrite -noautoopen | awk 'NR==1{print $1}')

# Custom volume icon
if [ -f "$APP_BUNDLE/Contents/Resources/app.icns" ]; then
    cp "$APP_BUNDLE/Contents/Resources/app.icns" "/Volumes/$APP_NAME/.VolumeIcon.icns"
    if [ -x "/usr/bin/SetFile" ]; then
        /usr/bin/SetFile -a C "/Volumes/$APP_NAME" 2>/dev/null || true
    fi
fi

# Configure Finder layout via native AppleScript
echo "Configuring Finder window layout..."
osascript << APPLESCRIPT
tell application "Finder"
    tell disk "$APP_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {200, 150, 860, 590}
        set theViewOptions to the icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 120
        set background picture of theViewOptions to (POSIX file "/Volumes/$APP_NAME/.background/dmg_background.tiff" as alias)
        set position of item "$APP_NAME.app" of container window to {170, 205}
        set position of item "Applications" of container window to {490, 205}
        close
        open
        update without registering applications
        delay 1
    end tell
end tell
APPLESCRIPT

sync
echo "Detaching writable disk image..."
hdiutil detach "$DEV" || hdiutil detach "$DEV" -force

echo "Converting to final compressed DMG..."
hdiutil convert "$TMP_DMG" -format UDZO -ov -o "$NEW_DMG"
hdiutil verify "$NEW_DMG"
if [ -f "$DMG_PATH" ]; then
    mv "$DMG_PATH" "$PREVIOUS_DMG"
fi
mv "$NEW_DMG" "$DMG_PATH"
BUILD_SUCCEEDED=1
rm -f "$TMP_DMG" "$DIST_DIR"/dmg_background*

echo "=========================================================="
echo "🎉 SUCCESS: Styled Native macOS DMG created!"
echo "📍 Location: $DMG_PATH"
echo "=========================================================="
