import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        ensureServerRunning()
        setupMenu()
        setupWindow()
        loadApp()
        NSApp.activate(ignoringOtherApps: true)
    }

    func ensureServerRunning() {
        // Check if port 3333 is reachable
        let url = URL(string: "http://localhost:3333/api/jobs")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 0.5
        
        let semaphore = DispatchSemaphore(value: 0)
        var isAlive = false
        
        let task = URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                isAlive = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 0.6)

        if !isAlive {
            startServerProcess()
        }
    }

    func startServerProcess() {
        let fileManager = FileManager.default
        var repoPath = fileManager.currentDirectoryPath
        
        if let resURL = Bundle.main.resourceURL, fileManager.fileExists(atPath: resURL.appendingPathComponent("app/server.ts").path) {
            repoPath = resURL.path
        } else if !fileManager.fileExists(atPath: "\(repoPath)/app/server.ts") {
            let bundleParent = Bundle.main.bundleURL.deletingLastPathComponent().path
            if fileManager.fileExists(atPath: "\(bundleParent)/app/server.ts") {
                repoPath = bundleParent
            }
        }

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/bash")
        
        let script = """
        export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$PATH"
        if [ -d "\(repoPath)" ]; then
            cd "\(repoPath)"
            exec bun run app/server.ts
        fi
        """
        proc.arguments = ["-c", script]
        
        do {
            try proc.run()
            self.serverProcess = proc
            Thread.sleep(forTimeInterval: 0.8)
        } catch {
            print("Failed to start server: \(error)")
        }
    }

    func setupWindow() {
        let screenSize = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1440, height: 900)
        let width = min(1360, screenSize.width * 0.92)
        let height = min(880, screenSize.height * 0.90)
        let rect = NSRect(x: (screenSize.width - width) / 2, y: (screenSize.height - height) / 2, width: width, height: height)

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "AI Job Search Studio"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.center()

        // Create WebKit Configuration
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self

        // Dark background matching Apple design system
        window.backgroundColor = NSColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1.0)
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
    }

    func loadApp() {
        let url = URL(string: "http://localhost:3333")!
        webView.load(URLRequest(url: url))
    }

    func setupMenu() {
        let mainMenu = NSMenu()

        // App menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu

        appMenu.addItem(withTitle: "About AI Job Search Studio", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide AI Job Search Studio", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit AI Job Search Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu (Standard macOS Copy/Paste)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // View Menu (Reload / Zoom)
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        let reloadItem = NSMenuItem(title: "Reload Page", action: #selector(reloadApp), keyEquivalent: "r")
        viewMenu.addItem(reloadItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        NSApp.mainMenu = mainMenu
    }

    @objc func reloadApp() {
        webView.reload()
    }

    // Handle target="_blank" links: Open in external browser (Safari/Chrome)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            if (url.scheme == "http" || url.scheme == "https") && url.host != "localhost" && url.host != "127.0.0.1" {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url {
            // Ignore non-http/https schemes like blob, data, about
            if url.scheme != "http" && url.scheme != "https" {
                decisionHandler(.allow)
                return
            }

            // If user clicks an external link like linkedin, github, overleaf, etc., open in default browser
            if url.host != "localhost" && url.host != "127.0.0.1" {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let proc = serverProcess, proc.isRunning {
            proc.terminate()
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
