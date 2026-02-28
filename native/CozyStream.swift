import AppKit
import Foundation

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var serverProcess: Process?
    private var healthTimer: Timer?
    private var serverRunning = false
    private var isQuitting = false
    private let serverPort: Int = 3001

    // MARK: Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        startServer()
        startHealthMonitor()

        // Open the browser after a short delay to let the server start
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            self?.openApp()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        isQuitting = true
        healthTimer?.invalidate()
        stopServer()
    }

    // MARK: Status Item

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            let resourcePath = Bundle.main.resourcePath ?? ""
            let iconPath = "\(resourcePath)/tray-iconTemplate.png"

            if let image = NSImage(contentsOfFile: iconPath) {
                image.isTemplate = true
                image.size = NSSize(width: 18, height: 18)
                button.image = image
            } else {
                button.title = "CS"
            }
        }

        rebuildMenu()
    }

    private func rebuildMenu() {
        let menu = NSMenu()

        let statusText = serverRunning
            ? "Server: Running on port \(serverPort)"
            : "Server: Starting..."
        let statusMenuItem = NSMenuItem(title: statusText, action: nil, keyEquivalent: "")
        statusMenuItem.isEnabled = false
        menu.addItem(statusMenuItem)

        menu.addItem(NSMenuItem.separator())

        let openItem = NSMenuItem(title: "Open CozyStream",
                                  action: #selector(openApp), keyEquivalent: "o")
        openItem.target = self
        menu.addItem(openItem)

        menu.addItem(NSMenuItem.separator())

        let scanItem = NSMenuItem(title: "Check for Library Updates",
                                  action: #selector(triggerScan), keyEquivalent: "")
        scanItem.target = self
        menu.addItem(scanItem)

        let prefsItem = NSMenuItem(title: "Preferences...",
                                   action: #selector(openPreferences), keyEquivalent: ",")
        prefsItem.target = self
        menu.addItem(prefsItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit CozyStream",
                                  action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    // MARK: Server Management

    private func startServer() {
        let resourcePath = Bundle.main.resourcePath!
        let nodePath = "\(resourcePath)/node"
        let serverScript = "\(resourcePath)/server/dist/index.js"

        guard FileManager.default.fileExists(atPath: nodePath) else {
            NSLog("[CozyStream] Node binary not found at: %@", nodePath)
            return
        }
        guard FileManager.default.fileExists(atPath: serverScript) else {
            NSLog("[CozyStream] Server script not found at: %@", serverScript)
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [serverScript]

        var env = ProcessInfo.processInfo.environment
        env["COZYSTREAM_SERVE_FRONTEND"] = "true"
        env["COZYSTREAM_FRONTEND_PATH"] = "\(resourcePath)/browser"
        env["PORT"] = String(serverPort)
        process.environment = env
        process.currentDirectoryURL = URL(fileURLWithPath: resourcePath)

        let pipe = Pipe()
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty, let str = String(data: data, encoding: .utf8) {
                NSLog("[server] %@", str.trimmingCharacters(in: .whitespacesAndNewlines))
            }
        }
        process.standardOutput = pipe
        process.standardError = pipe

        process.terminationHandler = { [weak self] proc in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.serverRunning = false
                self.rebuildMenu()

                // Auto-restart on unexpected exit (but not when quitting)
                if !self.isQuitting && proc.terminationStatus != 0 {
                    NSLog("[CozyStream] Server exited with status %d, restarting in 3s...",
                          proc.terminationStatus)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                        self?.startServer()
                    }
                }
            }
        }

        do {
            try process.run()
            serverProcess = process
            NSLog("[CozyStream] Server started (PID: %d)", process.processIdentifier)
        } catch {
            NSLog("[CozyStream] Failed to start server: %@", error.localizedDescription)
        }
    }

    private func stopServer() {
        guard let process = serverProcess, process.isRunning else { return }
        process.interrupt() // SIGINT for graceful shutdown

        // Wait up to 5 seconds for graceful shutdown, then force terminate
        DispatchQueue.global().async {
            let deadline = Date().addingTimeInterval(5)
            while process.isRunning && Date() < deadline {
                Thread.sleep(forTimeInterval: 0.1)
            }
            if process.isRunning {
                process.terminate()
            }
        }
    }

    // MARK: Health Monitor

    private func startHealthMonitor() {
        healthTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.checkHealth()
        }
    }

    private func checkHealth() {
        guard let url = URL(string: "http://localhost:\(serverPort)/health") else { return }
        var request = URLRequest(url: url)
        request.timeoutInterval = 3

        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            let running = (response as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async {
                guard let self = self else { return }
                if self.serverRunning != running {
                    self.serverRunning = running
                    self.rebuildMenu()
                }
            }
        }.resume()
    }

    // MARK: Actions

    @objc private func openApp() {
        openURL("http://localhost:\(serverPort)")
    }

    @objc private func openPreferences() {
        openURL("http://localhost:\(serverPort)/settings")
    }

    @objc private func triggerScan() {
        guard let url = URL(string: "http://localhost:\(serverPort)/api/library/internal-scan") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("0", forHTTPHeaderField: "Content-Length")
        URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()
    }

    @objc private func quitApp() {
        isQuitting = true
        stopServer()
        NSApp.terminate(nil)
    }

    private func openURL(_ urlString: String) {
        if let url = URL(string: urlString) {
            NSWorkspace.shared.open(url)
        }
    }
}

// MARK: - Entry Point

NSApplication.shared.setActivationPolicy(.accessory)
let delegate = AppDelegate()
NSApplication.shared.delegate = delegate
NSApplication.shared.run()
