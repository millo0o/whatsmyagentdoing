// Floating Office: the 2D office on your desktop, transparent and always on top.
// Build with desktop/build.sh. Menu bar icon: size, click-through, reload, quit.
import Cocoa
import WebKit

let defaults = UserDefaults.standard
func officeURL() -> URL {
  // "bare": furniture and characters only, no floor or walls.
  URL(string: "http://localhost:4545/?float=1" + (defaults.bool(forKey: "bare") ? "&bare=1" : ""))!
}
let skillDir = (NSHomeDirectory() as NSString).appendingPathComponent(".claude/skills/myoffice")

// Drag anywhere to move the window; plain clicks and hovers still reach the page.
final class DragWebView: WKWebView {
  var makeMenu: (() -> NSMenu)?
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
  // Right-click shows the app menu instead of the web page's menu.
  override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
    guard let mine = makeMenu?() else { return }
    menu.removeAllItems()
    for item in mine.items { mine.removeItem(item); menu.addItem(item) }
  }
}

// Keep the whole window (and its resize corner) on the visible screen.
func fitOnScreen(_ r: NSRect) -> NSRect {
  let mid = NSPoint(x: r.midX, y: r.midY)
  let vis = (NSScreen.screens.first { $0.frame.contains(mid) } ?? NSScreen.main)?.visibleFrame ?? r
  var f = r
  f.size.width = min(f.width, vis.width)
  f.size.height = min(f.height, vis.height)
  f.origin.x = min(max(f.minX, vis.minX), vis.maxX - f.width)
  f.origin.y = min(max(f.minY, vis.minY), vis.maxY - f.height)
  return f
}

// Bottom-right corner: drag to resize (keeps the top-left corner in place).
final class ResizeGrip: NSView {
  override func draw(_ dirtyRect: NSRect) {
    NSColor(calibratedRed: 0.42, green: 0.29, blue: 0.23, alpha: 0.8).setStroke()
    for i in 0..<3 {
      let o = CGFloat(i) * 5 + 4
      let p = NSBezierPath()
      p.lineWidth = 2.2
      p.lineCapStyle = .round
      p.move(to: NSPoint(x: bounds.maxX - o, y: 3))
      p.line(to: NSPoint(x: bounds.maxX - 3, y: o))
      p.stroke()
    }
  }
  override func resetCursorRects() { addCursorRect(bounds, cursor: .crosshair) }
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override func mouseDown(with event: NSEvent) {
    guard let win = window else { return }
    let start = NSEvent.mouseLocation, startFrame = win.frame
    while let e = win.nextEvent(matching: [.leftMouseDragged, .leftMouseUp]) {
      if e.type == .leftMouseUp { break }
      let now = NSEvent.mouseLocation
      let w = max(260, startFrame.width + (now.x - start.x))
      let h = max(200, startFrame.height - (now.y - start.y))
      win.setFrame(fitOnScreen(NSRect(x: startFrame.minX, y: startFrame.maxY - h, width: w, height: h)), display: true)
    }
  }
}

final class FloatPanel: NSPanel {
  override var canBecomeKey: Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSMenuDelegate {
  // Rebuild the menu bar menu each time so checkmarks are current.
  func menuNeedsUpdate(_ menu: NSMenu) {
    menu.removeAllItems()
    let fresh = makeMenu()
    for item in fresh.items { fresh.removeItem(item); menu.addItem(item) }
  }
  var panel: FloatPanel!
  var web: DragWebView!
  var status: NSStatusItem!
  var server: Process?

  func applicationDidFinishLaunching(_ note: Notification) {
    startServer()

    let size = NSSize(width: 900, height: 680)
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
    panel.setFrame(fitOnScreen(panel.frame), display: false)

    let config = WKWebViewConfiguration()
    let root = NSView(frame: panel.contentView!.bounds)
    root.autoresizingMask = [.width, .height]
    web = DragWebView(frame: root.bounds, configuration: config)
    web.autoresizingMask = [.width, .height]
    web.setValue(false, forKey: "drawsBackground")
    web.navigationDelegate = self
    web.makeMenu = { [weak self] in self?.makeMenu() ?? NSMenu() }
    root.addSubview(web)
    let grip = ResizeGrip(frame: NSRect(x: root.bounds.maxX - 24, y: 0, width: 24, height: 24))
    grip.autoresizingMask = [.minXMargin, .maxYMargin]
    root.addSubview(grip)
    panel.contentView = root
    web.load(URLRequest(url: officeURL()))
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
      self?.web.load(URLRequest(url: officeURL()))
    }
  }

  func makeMenu() -> NSMenu {
    let m = NSMenu()
    let bare = defaults.bool(forKey: "bare")
    m.addItem(withTitle: "사무실 보기", action: #selector(roomMode), keyEquivalent: "").state = bare ? .off : .on
    m.addItem(withTitle: "가구만 보기 (바닥·벽 없음)", action: #selector(bareMode), keyEquivalent: "").state = bare ? .on : .off
    m.addItem(.separator())
    m.addItem(withTitle: "작게", action: #selector(small), keyEquivalent: "")
    m.addItem(withTitle: "보통", action: #selector(medium), keyEquivalent: "")
    m.addItem(withTitle: "크게", action: #selector(large), keyEquivalent: "")
    m.addItem(.separator())
    m.addItem(withTitle: "클릭 통과 (마우스가 뒤로 지나감)", action: #selector(toggleClickThrough), keyEquivalent: "").state = panel.ignoresMouseEvents ? .on : .off
    m.addItem(withTitle: "새로고침", action: #selector(reload), keyEquivalent: "")
    m.addItem(withTitle: "브라우저에서 열기", action: #selector(openBrowser), keyEquivalent: "")
    m.addItem(.separator())
    m.addItem(withTitle: "종료", action: #selector(quit), keyEquivalent: "")
    for item in m.items { item.target = self }
    return m
  }

  func buildMenu() {
    status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    status.button?.title = "🏢"
    status.menu = makeMenu()
    status.menu?.delegate = self
  }

  func resize(_ w: CGFloat, _ h: CGFloat) {
    var f = panel.frame
    f.origin.y += f.height - h
    f.size = NSSize(width: w, height: h)
    panel.setFrame(fitOnScreen(f), display: true, animate: true)
  }
  @objc func small() { resize(560, 420) }
  @objc func medium() { resize(900, 680) }
  @objc func large() { resize(1300, 980) }
  @objc func roomMode() { defaults.set(false, forKey: "bare"); reload() }
  @objc func bareMode() { defaults.set(true, forKey: "bare"); reload() }
  @objc func toggleClickThrough() { panel.ignoresMouseEvents.toggle() }
  @objc func reload() { web.load(URLRequest(url: officeURL())) }
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
