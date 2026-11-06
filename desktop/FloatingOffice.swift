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

// Shows a soft frame while the mouse is over the window, so its edges and
// resize corner are easy to find; invisible otherwise.
final class HoverFrame: NSView {
  var grip: NSView?
  override init(frame: NSRect) {
    super.init(frame: frame)
    wantsLayer = true
    layer?.cornerRadius = 14
    layer?.borderWidth = 2
    layer?.borderColor = NSColor(calibratedRed: 0.42, green: 0.29, blue: 0.23, alpha: 0.6).cgColor
    layer?.backgroundColor = NSColor(calibratedWhite: 1, alpha: 0.35).cgColor
    layer?.opacity = 0
  }
  required init?(coder: NSCoder) { fatalError() }
  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    for t in trackingAreas { removeTrackingArea(t) }
    addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self))
  }
  func show(_ on: Bool) {
    NSAnimationContext.runAnimationGroup { ctx in
      ctx.duration = 0.2
      layer?.opacity = on ? 1 : 0
      grip?.animator().alphaValue = on ? 1 : 0
    }
  }
  override func mouseEntered(with event: NSEvent) { show(true) }
  override func mouseExited(with event: NSEvent) { show(false) }
  override func hitTest(_ point: NSPoint) -> NSView? { nil } // clicks go to the office
}

// Width / height of the room, reported by the page; the window keeps this shape.
var roomAspect: CGFloat = 1.6

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
      let h = w / roomAspect
      win.setFrame(fitOnScreen(NSRect(x: startFrame.minX, y: startFrame.maxY - h, width: w, height: h)), display: true)
    }
  }
}

final class FloatPanel: NSPanel {
  override var canBecomeKey: Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSMenuDelegate, WKScriptMessageHandler {
  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name == "aspect", let a = message.body as? Double, a > 0.3, a < 5 else { return }
    roomAspect = CGFloat(a)
    // Snap the window to the room's shape, keeping its width and top edge.
    var f = panel.frame
    let h = f.width / roomAspect
    f.origin.y += f.height - h
    f.size.height = h
    panel.setFrame(fitOnScreen(f), display: true)
  }
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
  var clickThrough = false

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
    config.userContentController.add(self, name: "aspect")
    let root = NSView(frame: panel.contentView!.bounds)
    root.autoresizingMask = [.width, .height]
    let hover = HoverFrame(frame: root.bounds)
    hover.autoresizingMask = [.width, .height]
    root.addSubview(hover)
    web = DragWebView(frame: root.bounds, configuration: config)
    web.autoresizingMask = [.width, .height]
    web.setValue(false, forKey: "drawsBackground")
    web.navigationDelegate = self
    web.makeMenu = { [weak self] in self?.makeMenu() ?? NSMenu() }
    root.addSubview(web)
    let grip = ResizeGrip(frame: NSRect(x: root.bounds.maxX - 30, y: 0, width: 30, height: 30))
    grip.autoresizingMask = [.minXMargin, .maxYMargin]
    root.addSubview(grip)
    grip.alphaValue = 0
    hover.grip = grip
    panel.contentView = root
    web.load(URLRequest(url: officeURL()))
    panel.orderFrontRegardless()

    buildMenu()
    watchServer()
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
    // The dashboard went away (e.g. its terminal closed): start our own again.
    if server == nil || !(server!.isRunning) { startServer() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
      self?.web.load(URLRequest(url: officeURL()))
    }
  }

  // The page also loses its server while already loaded; check every 10s.
  func watchServer() {
    Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
      var req = URLRequest(url: URL(string: "http://localhost:4545/")!)
      req.timeoutInterval = 3
      URLSession.shared.dataTask(with: req) { _, resp, _ in
        if resp == nil { DispatchQueue.main.async { self?.retry() } }
      }.resume()
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
    m.addItem(withTitle: "클릭 통과 (⌥ 누른 채로 클릭하면 잠깐 해제)", action: #selector(toggleClickThrough), keyEquivalent: "").state = clickThrough ? .on : .off
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
    watchOptionKey()
    status.menu = makeMenu()
    status.menu?.delegate = self
  }

  func resize(_ w: CGFloat, _ hIgnored: CGFloat) {
    let h = w / roomAspect
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
  @objc func toggleClickThrough() {
    clickThrough.toggle()
    panel.ignoresMouseEvents = clickThrough
    status.button?.title = clickThrough ? "🏢👻" : "🏢"
  }
  // While click-through is on, holding Option over the window makes it clickable
  // again, so its right-click menu can turn click-through off.
  func watchOptionKey() {
    Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
      guard let self = self, self.clickThrough else { return }
      let wantClicks = NSEvent.modifierFlags.contains(.option) && self.panel.frame.contains(NSEvent.mouseLocation)
      if self.panel.ignoresMouseEvents == wantClicks { self.panel.ignoresMouseEvents = !wantClicks }
    }
  }
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
