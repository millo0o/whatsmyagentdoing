// Floating Office: the 2D office on your desktop, transparent and always on top.
// Build with desktop/build.sh. Menu bar icon: size, click-through, reload, quit.
import Cocoa
import WebKit

let officeURL = URL(string: "http://localhost:4545/?float=1")!
let skillDir = (NSHomeDirectory() as NSString).appendingPathComponent(".claude/skills/myoffice")

// Drag anywhere to move the window; plain clicks and hovers still reach the page.
final class DragWebView: WKWebView {
  private var downEvent: NSEvent?
  private var dragging = false
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override func mouseDown(with event: NSEvent) {
    downEvent = event
    dragging = false
    super.mouseDown(with: event)
  }
  override func mouseDragged(with event: NSEvent) {
    if !dragging, let down = downEvent {
      let dx = event.locationInWindow.x - down.locationInWindow.x
      let dy = event.locationInWindow.y - down.locationInWindow.y
      if dx * dx + dy * dy > 16 {
        dragging = true
        window?.performDrag(with: down)
        return
      }
    }
    if !dragging { super.mouseDragged(with: event) }
  }
}

final class FloatPanel: NSPanel {
  override var canBecomeKey: Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
  var panel: FloatPanel!
  var web: DragWebView!
  var status: NSStatusItem!
  var server: Process?
  var clickThroughItem: NSMenuItem!

  func applicationDidFinishLaunching(_ note: Notification) {
    startServer()

    let size = NSSize(width: 520, height: 400)
    let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
    let origin = NSPoint(x: screen.maxX - size.width - 24, y: screen.minY + 24)
    panel = FloatPanel(contentRect: NSRect(origin: origin, size: size),
                       styleMask: [.borderless, .nonactivatingPanel, .resizable],
                       backing: .buffered, defer: false)
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = false
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
    panel.isMovableByWindowBackground = true
    panel.hidesOnDeactivate = false
    panel.setFrameAutosaveName("FloatingOffice")

    let config = WKWebViewConfiguration()
    web = DragWebView(frame: panel.contentView!.bounds, configuration: config)
    web.autoresizingMask = [.width, .height]
    web.setValue(false, forKey: "drawsBackground")
    web.navigationDelegate = self
    panel.contentView = web
    web.load(URLRequest(url: officeURL))
    panel.orderFrontRegardless()

    buildMenu()
  }

  // Start the dashboard if it isn't running yet (if it is, the CLI just says so and exits).
  func startServer() {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/zsh")
    p.arguments = ["-lc", "PATH=\"$HOME/.local/node/bin:$PATH\" node \"\(skillDir)/bin/cli.js\" --no-open --hours 72"]
    p.standardOutput = FileHandle.nullDevice
    p.standardError = FileHandle.nullDevice
    try? p.run()
    server = p
  }

  // Server still starting (or stopped): try again shortly.
  func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { retry() }
  func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { retry() }
  func retry() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
      self?.web.load(URLRequest(url: officeURL))
    }
  }

  func buildMenu() {
    status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    status.button?.title = "🏢"
    let m = NSMenu()
    m.addItem(withTitle: "작게", action: #selector(small), keyEquivalent: "1")
    m.addItem(withTitle: "보통", action: #selector(medium), keyEquivalent: "2")
    m.addItem(withTitle: "크게", action: #selector(large), keyEquivalent: "3")
    m.addItem(.separator())
    clickThroughItem = m.addItem(withTitle: "클릭 통과 (마우스가 뒤로 지나감)", action: #selector(toggleClickThrough), keyEquivalent: "t")
    m.addItem(withTitle: "새로고침", action: #selector(reload), keyEquivalent: "r")
    m.addItem(withTitle: "브라우저에서 열기", action: #selector(openBrowser), keyEquivalent: "o")
    m.addItem(.separator())
    m.addItem(withTitle: "종료", action: #selector(quit), keyEquivalent: "q")
    for item in m.items { item.target = self }
    status.menu = m
  }

  func resize(_ w: CGFloat, _ h: CGFloat) {
    var f = panel.frame
    f.origin.y += f.height - h
    f.size = NSSize(width: w, height: h)
    panel.setFrame(f, display: true, animate: true)
  }
  @objc func small() { resize(360, 280) }
  @objc func medium() { resize(520, 400) }
  @objc func large() { resize(760, 580) }
  @objc func toggleClickThrough() {
    panel.ignoresMouseEvents.toggle()
    clickThroughItem.state = panel.ignoresMouseEvents ? .on : .off
  }
  @objc func reload() { web.load(URLRequest(url: officeURL)) }
  @objc func openBrowser() { NSWorkspace.shared.open(URL(string: "http://localhost:4545")!) }
  @objc func quit() { NSApp.terminate(nil) }

  func applicationWillTerminate(_ note: Notification) {
    if let s = server, s.isRunning { s.terminate() }
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
