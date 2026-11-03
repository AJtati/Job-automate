#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
APP_NAME="AI Job Search Studio"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
DMG_PATH="$DIST_DIR/AI-Job-Search-Studio.dmg"
STAGING_DIR="$DIST_DIR/dmg_staging"
HOST_ARCH="$(uname -m)"
if [ "$HOST_ARCH" = "x86_64" ]; then
    SWIFT_TARGET="x86_64-apple-macosx12.0"
else
    SWIFT_TARGET="arm64-apple-macosx12.0"
fi

echo "=========================================================="
echo "🍏 Building Native macOS Cocoa .app & DMG for AI Job Search"
echo "=========================================================="

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR" "$STAGING_DIR"
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
    <string>12.0</string>
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
swiftc -target "$SWIFT_TARGET" -O -framework Cocoa -framework WebKit \
    "$REPO_DIR/native_app/main.swift" \
    -o "$APP_BUNDLE/Contents/MacOS/AI Job Search Studio"

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

swiftc -target "$SWIFT_TARGET" -framework Cocoa "$DIST_DIR/generate_icon.swift" -o "$DIST_DIR/generate_icon"
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
cp -R "$REPO_DIR/app" "$APP_BUNDLE/Contents/Resources/"
rm -rf "$APP_BUNDLE/Contents/Resources/app/tests"
cp "$REPO_DIR/package.json" "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || true

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
mkdir -p "$APP_BUNDLE/Contents/Resources/data"
cp "$REPO_DIR/data/profiles.template.json" "$APP_BUNDLE/Contents/Resources/data/" 2>/dev/null || true
cp "$REPO_DIR/data/sponsor_register.json" "$APP_BUNDLE/Contents/Resources/data/" 2>/dev/null || true

# Bundle lightweight tools needed by the app at runtime
mkdir -p "$APP_BUNDLE/Contents/Resources/tools"
cp "$REPO_DIR/tools/scrape_jobspy.py" "$APP_BUNDLE/Contents/Resources/tools/" 2>/dev/null || true

# A packaged runtime makes the installed app independent of the user's PATH.
BUN_PATH="$(command -v bun 2>/dev/null || true)"
if [ -z "$BUN_PATH" ] || [ ! -x "$BUN_PATH" ]; then
    if [ -x "$HOME/.bun/bin/bun" ]; then
        BUN_PATH="$HOME/.bun/bin/bun"
    elif [ -x "/opt/homebrew/bin/bun" ]; then
        BUN_PATH="/opt/homebrew/bin/bun"
    elif [ -x "/usr/local/bin/bun" ]; then
        BUN_PATH="/usr/local/bin/bun"
    fi
fi
mkdir -p "$APP_BUNDLE/Contents/Resources/bin"
cp "$BUN_PATH" "$APP_BUNDLE/Contents/Resources/bin/bun"
chmod +x "$APP_BUNDLE/Contents/Resources/bin/bun"

# Bundle standalone Tectonic LaTeX engine so any user gets zero-dependency PDF compiling
TECTONIC_BIN="$REPO_DIR/bin/tectonic"
if [ ! -f "$TECTONIC_BIN" ]; then
    echo "Downloading standalone Tectonic for macOS ($HOST_ARCH)..."
    mkdir -p "$REPO_DIR/bin"
    if [ "$HOST_ARCH" = "x86_64" ]; then
        curl -sL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-apple-darwin.tar.gz" | tar -xz -C "$REPO_DIR/bin"
    else
        curl -sL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-aarch64-apple-darwin.tar.gz" | tar -xz -C "$REPO_DIR/bin"
    fi
    chmod +x "$TECTONIC_BIN"
fi
cp "$TECTONIC_BIN" "$APP_BUNDLE/Contents/Resources/bin/tectonic"
chmod +x "$APP_BUNDLE/Contents/Resources/bin/tectonic"

# 4. Generate Apple-designed retina DMG background (Multi-Resolution HiDPI TIFF)
echo "Generating Apple-designed retina DMG background..."
swiftc -target "$SWIFT_TARGET" -framework Cocoa "$REPO_DIR/tools/generate_dmg_background.swift" -o "$DIST_DIR/generate_dmg_background"
"$DIST_DIR/generate_dmg_background" "$DIST_DIR/dmg_background.tiff"
rm -f "$DIST_DIR/generate_dmg_background"

# 5. Build Styled macOS DMG Package using Native Finder AppleScript
echo "Creating styled macOS DMG installer..."
rm -f "$DMG_PATH"
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
hdiutil convert "$TMP_DMG" -format UDZO -ov -o "$DMG_PATH"
rm -f "$TMP_DMG" "$DIST_DIR"/dmg_background*

echo "=========================================================="
echo "🎉 SUCCESS: Styled Native macOS DMG created!"
echo "📍 Location: $DMG_PATH"
echo "=========================================================="
