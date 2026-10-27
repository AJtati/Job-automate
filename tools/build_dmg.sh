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
cp "$REPO_DIR/package.json" "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || true

# Bundle the exact zero-dependency scraper sources used by the server. Do not
# package node_modules or any local candidate/job data.
for SKILL in linkedin-search freehire-search; do
    TARGET="$APP_BUNDLE/Contents/Resources/.agents/skills/$SKILL/cli"
    mkdir -p "$TARGET"
    cp -R "$REPO_DIR/.agents/skills/$SKILL/cli/src" "$TARGET/"
    cp "$REPO_DIR/.agents/skills/$SKILL/cli/package.json" "$TARGET/" 2>/dev/null || true
done

# Bundle clean template data without any personal candidate data
mkdir -p "$APP_BUNDLE/Contents/Resources/data"
cp "$REPO_DIR/data/profiles.template.json" "$APP_BUNDLE/Contents/Resources/data/" 2>/dev/null || true

# A packaged runtime makes the installed app independent of the user's PATH.
BUN_PATH="$(command -v bun)"
mkdir -p "$APP_BUNDLE/Contents/Resources/bin"
cp "$BUN_PATH" "$APP_BUNDLE/Contents/Resources/bin/bun"
chmod +x "$APP_BUNDLE/Contents/Resources/bin/bun"

# 4. Prepare Staging Directory for DMG
echo "Preparing DMG staging folder..."
cp -R "$APP_BUNDLE" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

# 5. Build DMG using native macOS hdiutil
echo "Creating DMG package..."
rm -f "$DMG_PATH"
hdiutil create -volname "AI Job Search Studio" -srcfolder "$STAGING_DIR" -ov -format UDZO "$DMG_PATH"

rm -rf "$STAGING_DIR"

echo "=========================================================="
echo "🎉 SUCCESS: Native Cocoa DMG created with Dock presence!"
echo "📍 Location: $DMG_PATH"
echo "=========================================================="
