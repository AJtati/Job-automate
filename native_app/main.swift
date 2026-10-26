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
        let url = URL(string: "http://127.0.0.1:3333/api/jobs")!
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

        window.backgroundColor = .windowBackgroundColor
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)

        // Fail-safe keyboard monitor: pressing Escape key (keyCode 53) returns to root app if stuck
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self else { return event }
            if event.keyCode == 53 {
                if let currentURL = self.webView.url, currentURL.path != "/" && currentURL.path != "" {
                    self.loadApp()
                    return nil
                }
            }
            return event
        }
    }

    func loadApp() {
        let url = URL(string: "http://127.0.0.1:3333/")!
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

        // View Menu (Reload / Navigation)
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        let homeItem = NSMenuItem(title: "Return to Job Studio (Home)", action: #selector(returnToHome), keyEquivalent: "0")
        homeItem.keyEquivalentModifierMask = [.command]
        viewMenu.addItem(homeItem)
        let backItem = NSMenuItem(title: "Back to App", action: #selector(goBack), keyEquivalent: "[")
        backItem.keyEquivalentModifierMask = [.command]
        viewMenu.addItem(backItem)
        let fwdItem = NSMenuItem(title: "Forward", action: #selector(goForward), keyEquivalent: "]")
        fwdItem.keyEquivalentModifierMask = [.command]
        viewMenu.addItem(fwdItem)
        viewMenu.addItem(NSMenuItem.separator())
        let reloadItem = NSMenuItem(title: "Reload Page", action: #selector(reloadApp), keyEquivalent: "r")
        reloadItem.keyEquivalentModifierMask = [.command]
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

    @objc func returnToHome() {
        loadApp()
    }

    @objc func reloadApp() {
        webView.reload()
    }

    @objc func goBack() {
        if webView.canGoBack {
            webView.goBack()
        } else {
            loadApp()
        }
    }

    @objc func goForward() {
        if webView.canGoForward {
            webView.goForward()
        }
    }

    // Handle target="_blank" links: Open in external browser (Safari/Chrome)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if url.scheme == "http" || url.scheme == "https" {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        let isLocal = (url.host == "localhost" || url.host == "127.0.0.1")
        let isRoot = (url.path == "/" || url.path == "" || url.path == "/index.html")

        // 1. Allow the initial load and reloads of the root SPA application
        if (url.scheme == "http" || url.scheme == "https") && isLocal && isRoot {
            decisionHandler(.allow)
            return
        }

        // 2. Open external web links in macOS default browser (Safari, Chrome, etc.)
        if (url.scheme == "http" || url.scheme == "https") && !isLocal {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        // 3. For any PDF or document endpoints, open in macOS Preview.app rather than navigating WKWebView
        if url.path.hasPrefix("/api/pdf") || url.path.hasSuffix(".pdf") {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        // 4. BLOCK any other top-level navigation (blob:, file:, data:, non-root local URLs)
        // This guarantees that WKWebView NEVER replaces the application with a PDF viewer or blank page!
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        // Block PDF MIME type from rendering inside WKWebView
        if let mimeType = navigationResponse.response.mimeType, mimeType == "application/pdf" {
            decisionHandler(.cancel)
            return
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
