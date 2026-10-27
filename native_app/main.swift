import Cocoa
import WebKit
import UniformTypeIdentifiers

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?
    var serverURL = URL(string: "http://127.0.0.1:3333")!
    var serverLogURL: URL?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        guard ensureServerRunning() else {
            setupMenu()
            showStartupFailure()
            NSApp.terminate(nil)
            return
        }
        setupMenu()
        setupWindow()
        loadApp()
        NSApp.activate(ignoringOtherApps: true)
    }

    func ensureServerRunning() -> Bool {
        let fileManager = FileManager.default
        var repoPath = fileManager.currentDirectoryPath
        var isBundledApp = false

        if let resURL = Bundle.main.resourceURL, fileManager.fileExists(atPath: resURL.appendingPathComponent("app/server.ts").path) {
            repoPath = resURL.path
            isBundledApp = true
        } else if !fileManager.fileExists(atPath: "\(repoPath)/app/server.ts") {
            let bundleParent = Bundle.main.bundleURL.deletingLastPathComponent().path
            if fileManager.fileExists(atPath: "\(bundleParent)/app/server.ts") {
                repoPath = bundleParent
                isBundledApp = true
            }
        }

        let dataRoot: URL
        if !isBundledApp && fileManager.fileExists(atPath: "\(repoPath)/data/profiles.json") {
            dataRoot = URL(fileURLWithPath: repoPath)
            serverLogURL = dataRoot.appendingPathComponent("data/server.log")
        } else {
            guard let prepared = prepareDataDirectory(appRoot: repoPath) else { return false }
            dataRoot = prepared
        }

        let bunCandidates = [
            "\(repoPath)/bin/bun",
            "/opt/homebrew/bin/bun",
            "/usr/local/bin/bun",
            fileManager.homeDirectoryForCurrentUser.appendingPathComponent(".bun/bin/bun").path,
        ]
        guard let bunPath = bunCandidates.first(where: { fileManager.isExecutableFile(atPath: $0) }) else { return false }

        for _ in 0..<8 {
            let port = Int.random(in: 41000...49999)
            let token = UUID().uuidString
            if startServerProcess(bunPath: bunPath, appRoot: repoPath, dataRoot: dataRoot.path, port: port, token: token), waitForHealth(port: port, token: token) {
                serverURL = URL(string: "http://127.0.0.1:\(port)")!
                return true
            }
            if let proc = serverProcess, proc.isRunning { proc.terminate() }
            serverProcess = nil
        }
        return false
    }

    func prepareDataDirectory(appRoot: String) -> URL? {
        let fileManager = FileManager.default
        guard let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let dataRoot = support.appendingPathComponent("AI Job Search Studio", isDirectory: true)
        do {
            try fileManager.createDirectory(at: dataRoot, withIntermediateDirectories: true)
            for name in ["data", "cv", "cover_letters", "job_scraper"] {
                let source = URL(fileURLWithPath: appRoot).appendingPathComponent(name)
                let destination = dataRoot.appendingPathComponent(name)
                if fileManager.fileExists(atPath: source.path) && !fileManager.fileExists(atPath: destination.path) {
                    try fileManager.copyItem(at: source, to: destination)
                }
            }

            // Ensure profiles.json is seeded from workspace if available and destination is missing or empty
            let destProfiles = dataRoot.appendingPathComponent("data/profiles.json")
            var needsSeed = !fileManager.fileExists(atPath: destProfiles.path)
            if !needsSeed, let data = try? Data(contentsOf: destProfiles),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let profiles = json["profiles"] as? [[String: Any]],
               profiles.allSatisfy({ ($0["name"] as? String)?.trimmingCharacters(in: .whitespaces).isEmpty ?? true }) {
                needsSeed = true
            }
            if needsSeed {
                let seed = URL(fileURLWithPath: appRoot).appendingPathComponent("data/profiles.json")
                if fileManager.fileExists(atPath: seed.path) {
                    try? fileManager.createDirectory(at: dataRoot.appendingPathComponent("data"), withIntermediateDirectories: true)
                    try? fileManager.removeItem(at: destProfiles)
                    try? fileManager.copyItem(at: seed, to: destProfiles)
                }
            }

            // Ensure ai_config.json is seeded from workspace if available and destination is missing or unconfigured
            let destAiConfig = dataRoot.appendingPathComponent("data/ai_config.json")
            var needsAiSeed = !fileManager.fileExists(atPath: destAiConfig.path)
            if !needsAiSeed, let data = try? Data(contentsOf: destAiConfig),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let anthropic = (json["anthropicApiKey"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
                let openai = (json["openaiApiKey"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
                if anthropic.isEmpty && openai.isEmpty { needsAiSeed = true }
            }
            if needsAiSeed {
                let seed = URL(fileURLWithPath: appRoot).appendingPathComponent("data/ai_config.json")
                if fileManager.fileExists(atPath: seed.path) {
                    try? fileManager.createDirectory(at: dataRoot.appendingPathComponent("data"), withIntermediateDirectories: true)
                    try? fileManager.removeItem(at: destAiConfig)
                    try? fileManager.copyItem(at: seed, to: destAiConfig)
                }
            }

            // Ensure search_config.json is seeded from workspace if available and destination is missing or unconfigured
            let destSearchConfig = dataRoot.appendingPathComponent("data/search_config.json")
            var needsSearchSeed = !fileManager.fileExists(atPath: destSearchConfig.path)
            if !needsSearchSeed, let data = try? Data(contentsOf: destSearchConfig),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let cvKey = (json["cvLibraryApiKey"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
                let reedKey = (json["reedApiKey"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
                let serpKey = (json["serpApiKey"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
                let adzunaKey = (json["adzunaAppKey"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
                if cvKey.isEmpty && reedKey.isEmpty && serpKey.isEmpty && adzunaKey.isEmpty {
                    needsSearchSeed = true
                }
            }
            if needsSearchSeed {
                let seed = URL(fileURLWithPath: appRoot).appendingPathComponent("data/search_config.json")
                if fileManager.fileExists(atPath: seed.path) {
                    try? fileManager.createDirectory(at: dataRoot.appendingPathComponent("data"), withIntermediateDirectories: true)
                    try? fileManager.removeItem(at: destSearchConfig)
                    try? fileManager.copyItem(at: seed, to: destSearchConfig)
                }
            }

            let trackerSource = URL(fileURLWithPath: appRoot).appendingPathComponent("job_search_tracker.csv")
            let trackerDestination = dataRoot.appendingPathComponent("job_search_tracker.csv")
            if fileManager.fileExists(atPath: trackerSource.path) && !fileManager.fileExists(atPath: trackerDestination.path) {
                try fileManager.copyItem(at: trackerSource, to: trackerDestination)
            }
            serverLogURL = dataRoot.appendingPathComponent("server.log")
            return dataRoot
        } catch {
            return nil
        }
    }

    func startServerProcess(bunPath: String, appRoot: String, dataRoot: String, port: Int, token: String) -> Bool {
        let fileManager = FileManager.default

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: bunPath)
        proc.currentDirectoryURL = URL(fileURLWithPath: appRoot)
        proc.arguments = ["run", "app/server.ts"]
        var environment = ProcessInfo.processInfo.environment
        environment["PORT"] = String(port)
        environment["AI_JOB_SEARCH_APP_ROOT"] = appRoot
        environment["AI_JOB_SEARCH_ROOT"] = dataRoot
        environment["AI_JOB_SEARCH_INSTANCE_TOKEN"] = token
        proc.environment = environment
        if let logURL = serverLogURL {
            fileManager.createFile(atPath: logURL.path, contents: nil)
            if let handle = try? FileHandle(forWritingTo: logURL) {
                proc.standardOutput = handle
                proc.standardError = handle
            }
        }
        
        do {
            try proc.run()
            self.serverProcess = proc
            return true
        } catch {
            return false
        }
    }

    func waitForHealth(port: Int, token: String) -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)/api/health") else { return false }
        for _ in 0..<30 {
            let semaphore = DispatchSemaphore(value: 0)
            var matches = false
            var request = URLRequest(url: url)
            request.timeoutInterval = 0.4
            URLSession.shared.dataTask(with: request) { data, response, _ in
                if let http = response as? HTTPURLResponse, http.statusCode == 200,
                   let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   json["instanceToken"] as? String == token {
                    matches = true
                }
                semaphore.signal()
            }.resume()
            _ = semaphore.wait(timeout: .now() + 0.5)
            if matches { return true }
            Thread.sleep(forTimeInterval: 0.15)
        }
        return false
    }

    func showStartupFailure() {
        let alert = NSAlert()
        alert.messageText = "AI Job Search Studio could not start"
        alert.informativeText = "Reinstall the latest app package and try again. If the problem continues, install Bun from https://bun.sh and review the server log at:\n\n\(serverLogURL?.path ?? "~/Library/Application Support/AI Job Search Studio/server.log")"
        alert.alertStyle = .critical
        alert.addButton(withTitle: "OK")
        alert.runModal()
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
        let url = serverURL.appendingPathComponent("")
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

    // Handle HTML5 <input type="file"> file selection dialogs (NSOpenPanel)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let openPanel = NSOpenPanel()
        openPanel.canChooseFiles = true
        openPanel.canChooseDirectories = false
        openPanel.allowsMultipleSelection = parameters.allowsMultipleSelection
        openPanel.prompt = "Select"
        openPanel.message = "Choose your resume file (.pdf, .tex, .txt, .md)"
        openPanel.allowsOtherFileTypes = true

        if #available(macOS 12.0, *) {
            var types: [UTType] = [.pdf, .plainText, .text]
            if let texType = UTType(filenameExtension: "tex") { types.append(texType) }
            if let mdType = UTType(filenameExtension: "md") { types.append(mdType) }
            openPanel.allowedContentTypes = types
        }

        if let win = self.window {
            openPanel.beginSheetModal(for: win) { response in
                if response == .OK {
                    completionHandler(openPanel.urls)
                } else {
                    completionHandler(nil)
                }
            }
        } else {
            let response = openPanel.runModal()
            if response == .OK {
                completionHandler(openPanel.urls)
            } else {
                completionHandler(nil)
            }
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "AI Job Search Studio"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        if let win = self.window {
            alert.beginSheetModal(for: win) { response in
                completionHandler(response == .alertFirstButtonReturn)
            }
        } else {
            let response = alert.runModal()
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "AI Job Search Studio"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        if let win = self.window {
            alert.beginSheetModal(for: win) { _ in
                completionHandler()
            }
        } else {
            _ = alert.runModal()
            completionHandler()
        }
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
