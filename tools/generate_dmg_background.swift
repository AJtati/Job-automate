import Cocoa

func renderModernBackground(scale: CGFloat) -> NSImage {
    let width: CGFloat = 660
    let height: CGFloat = 440
    let pixelSize = NSSize(width: width * scale, height: height * scale)
    
    let img = NSImage(size: pixelSize)
    img.lockFocus()
    
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        img.unlockFocus()
        return img
    }
    
    ctx.scaleBy(x: scale, y: scale)
    
    // -------------------------------------------------------------
    // 1. Atmosphere: Apple Frosted Silver / Aluminum Canvas
    // -------------------------------------------------------------
    let canvasRect = NSRect(x: 0, y: 0, width: width, height: height)
    let bgGradient = NSGradient(colors: [
        NSColor(red: 0.94, green: 0.96, blue: 0.98, alpha: 1.0), // #F0F4F8
        NSColor(red: 0.90, green: 0.92, blue: 0.96, alpha: 1.0), // #E6EBF5
        NSColor(red: 0.86, green: 0.89, blue: 0.93, alpha: 1.0)  // #DCE3ED
    ])
    bgGradient?.draw(in: canvasRect, angle: -60)
    
    // Subtle central blue luminescence
    ctx.saveGState()
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let glowColors = [
        NSColor(red: 0.08, green: 0.45, blue: 0.98, alpha: 0.08).cgColor,
        NSColor(red: 0.08, green: 0.45, blue: 0.98, alpha: 0.00).cgColor
    ] as CFArray
    let glowLocations: [CGFloat] = [0.0, 1.0]
    if let radial = CGGradient(colorsSpace: colorSpace, colors: glowColors, locations: glowLocations) {
        ctx.drawRadialGradient(
            radial,
            startCenter: CGPoint(x: width / 2, y: 240),
            startRadius: 10,
            endCenter: CGPoint(x: width / 2, y: 240),
            endRadius: 280,
            options: []
        )
    }
    ctx.restoreGState()
    
    // -------------------------------------------------------------
    // 2. Center Frosted Platter (Light Glass Platter)
    // -------------------------------------------------------------
    let cardRect = NSRect(x: 22, y: 22, width: width - 44, height: height - 44)
    let cardPath = NSBezierPath(roundedRect: cardRect, xRadius: 22, yRadius: 22)
    
    // Crisp white glass fill
    NSColor(white: 1.0, alpha: 0.88).setFill()
    cardPath.fill()
    
    // Outer hairline bezel
    NSColor(white: 0.0, alpha: 0.08).setStroke()
    cardPath.lineWidth = 1.0
    cardPath.stroke()
    
    // -------------------------------------------------------------
    // 3. Typography: SF Pro Hierarchy (Charcoal on White - Max Contrast)
    // -------------------------------------------------------------
    // Headline
    let title = "AI Job Search Studio" as NSString
    let titleFont = NSFont.systemFont(ofSize: 22, weight: .semibold)
    let titleAttr: [NSAttributedString.Key: Any] = [
        .font: titleFont,
        .foregroundColor: NSColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0), // Deep Slate #0F172A
        .kern: -0.35 // Apple tracking for 22pt display font
    ]
    let titleSize = title.size(withAttributes: titleAttr)
    let titleOrigin = NSPoint(x: (width - titleSize.width) / 2, y: height - 66)
    title.draw(at: titleOrigin, withAttributes: titleAttr)
    
    // Sub-headline
    let subTitle = "Drag to Applications to install" as NSString
    let subFont = NSFont.systemFont(ofSize: 13, weight: .regular)
    let subAttr: [NSAttributedString.Key: Any] = [
        .font: subFont,
        .foregroundColor: NSColor(red: 0.35, green: 0.40, blue: 0.50, alpha: 1.0), // Slate Grey #5A667F
        .kern: -0.1
    ]
    let subSize = subTitle.size(withAttributes: subAttr)
    let subOrigin = NSPoint(x: (width - subSize.width) / 2, y: height - 88)
    subTitle.draw(at: subOrigin, withAttributes: subAttr)
    
    // -------------------------------------------------------------
    // 4. Drop Target Wells (Recessed Soft Wells)
    // -------------------------------------------------------------
    // Finder coordinates: {170, 200} and {490, 200}
    // Cocoa coordinates: {170, 240} and {490, 240}
    let iconCenterY: CGFloat = 240
    let leftCenter = NSPoint(x: 170, y: iconCenterY)
    let rightCenter = NSPoint(x: 490, y: iconCenterY)
    
    func drawDropWell(center: NSPoint) {
        let wellRect = NSRect(x: center.x - 68, y: center.y - 68, width: 136, height: 136)
        let wellPath = NSBezierPath(roundedRect: wellRect, xRadius: 28, yRadius: 28)
        
        // Recessed soft silver fill
        NSColor(red: 0.93, green: 0.95, blue: 0.98, alpha: 0.92).setFill()
        wellPath.fill()
        
        // Delicate hairline border
        NSColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.06).setStroke()
        wellPath.lineWidth = 1.0
        wellPath.stroke()
    }
    
    drawDropWell(center: leftCenter)
    drawDropWell(center: rightCenter)
    
    // -------------------------------------------------------------
    // 5. Connecting Flow Indicator: Gradient Arrow + Pill
    // -------------------------------------------------------------
    let arrowY: CGFloat = iconCenterY - 6
    let arrowStart = NSPoint(x: 270, y: arrowY)
    let arrowEnd = NSPoint(x: 390, y: arrowY)
    
    // Arrow stem
    let stemPath = NSBezierPath()
    stemPath.move(to: arrowStart)
    stemPath.line(to: NSPoint(x: arrowEnd.x - 14, y: arrowEnd.y))
    stemPath.lineWidth = 3.5
    stemPath.lineCapStyle = .round
    NSColor(red: 0.08, green: 0.48, blue: 0.98, alpha: 1.0).setStroke()
    stemPath.stroke()
    
    // Arrow Head Chevron
    let headPath = NSBezierPath()
    headPath.move(to: NSPoint(x: arrowEnd.x - 15, y: arrowEnd.y + 11))
    headPath.line(to: arrowEnd)
    headPath.line(to: NSPoint(x: arrowEnd.x - 15, y: arrowEnd.y - 11))
    headPath.lineJoinStyle = .round
    headPath.lineCapStyle = .round
    headPath.lineWidth = 3.5
    NSColor(red: 0.08, green: 0.48, blue: 0.98, alpha: 1.0).setStroke()
    headPath.stroke()
    
    // Action Pill Badge: "INSTALL"
    let pillWidth: CGFloat = 82
    let pillHeight: CGFloat = 22
    let pillY: CGFloat = arrowY + 22
    let pillRect = NSRect(x: (width - pillWidth) / 2, y: pillY, width: pillWidth, height: pillHeight)
    let pillPath = NSBezierPath(roundedRect: pillRect, xRadius: pillHeight / 2, yRadius: pillHeight / 2)
    
    // Apple vibrant blue fill
    NSColor(red: 0.08, green: 0.48, blue: 0.98, alpha: 1.0).setFill()
    pillPath.fill()
    
    let badgeText = "INSTALL" as NSString
    let badgeFont = NSFont.systemFont(ofSize: 9.5, weight: .bold)
    let badgeAttr: [NSAttributedString.Key: Any] = [
        .font: badgeFont,
        .foregroundColor: NSColor.white,
        .kern: 1.0
    ]
    let badgeSize = badgeText.size(withAttributes: badgeAttr)
    let badgeOrigin = NSPoint(x: (width - badgeSize.width) / 2, y: pillY + (pillHeight - badgeSize.height) / 2)
    badgeText.draw(at: badgeOrigin, withAttributes: badgeAttr)
    
    // -------------------------------------------------------------
    // 6. Refined Footer Note
    // -------------------------------------------------------------
    let footer = "Native macOS App · Apple Silicon & Intel Universal" as NSString
    let footerFont = NSFont.systemFont(ofSize: 11, weight: .medium)
    let footerAttr: [NSAttributedString.Key: Any] = [
        .font: footerFont,
        .foregroundColor: NSColor(red: 0.55, green: 0.60, blue: 0.68, alpha: 1.0),
        .kern: -0.1
    ]
    let footerSize = footer.size(withAttributes: footerAttr)
    let footerOrigin = NSPoint(x: (width - footerSize.width) / 2, y: 38)
    footer.draw(at: footerOrigin, withAttributes: footerAttr)
    
    img.unlockFocus()
    return img
}

func savePNG(image: NSImage, path: String) {
    if let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) {
        let png = rep.representation(using: .png, properties: [:])
        try? png?.write(to: URL(fileURLWithPath: path))
    }
}

let outPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "dist/dmg_background.tiff"
let outUrl = URL(fileURLWithPath: outPath)
let dir = outUrl.deletingLastPathComponent().path
let baseName = outUrl.deletingPathExtension().lastPathComponent

let png1xPath = "\(dir)/\(baseName).png"
let png2xPath = "\(dir)/\(baseName)@2x.png"

let img1x = renderModernBackground(scale: 1.0)
let img2x = renderModernBackground(scale: 2.0)

savePNG(image: img1x, path: png1xPath)
savePNG(image: img2x, path: png2xPath)

// Compile into multi-resolution HiDPI TIFF
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/tiffutil")
process.arguments = ["-cathidpicheck", png1xPath, png2xPath, "-out", outPath]
try? process.run()
process.waitUntilExit()

print("Generated modern Apple HiDPI DMG background at \(outPath)")
