// Floating Office for Windows (also runs on Mac/Linux): a transparent,
// always-on-top window showing the office. Same features as the Mac app.
const { app, BrowserWindow, Menu, Tray, ipcMain, screen, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 4545;
const SKILL = path.resolve(__dirname, '..', '..');
const STATE = () => path.join(app.getPath('userData'), 'state.json');

let state = { bare: false, bounds: null };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE(), 'utf8')) }; } catch { /* first run */ }
const save = () => { try { fs.writeFileSync(STATE(), JSON.stringify(state)); } catch { /* ignore */ } };

let win, tray, aspect = 0, clickThrough = false, serverProc = null;

const officeURL = () => `http://localhost:${PORT}/?float=1${state.bare ? '&bare=1' : ''}`;

function ping() {
  return new Promise((res) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/ping', timeout: 1500 }, (r) => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.on('timeout', () => { req.destroy(); res(false); });
  });
}

// Start the dashboard server with Electron's own Node, so no separate Node install is needed.
function startServer() {
  if (serverProc && serverProc.exitCode == null) return;
  serverProc = spawn(process.execPath, [path.join(SKILL, 'bin', 'cli.js'), '--no-open', '--hours', '72'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore', detached: true, windowsHide: true,
  });
  serverProc.unref();
}

async function ensureServer() {
  if (await ping()) return true;
  startServer();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await ping()) return true;
  }
  return false;
}

// Keep the window fully on one screen.
function fitOnScreen(b) {
  const area = screen.getDisplayMatching(b).workArea;
  const width = Math.min(b.width, area.width), height = Math.min(b.height, area.height);
  const x = Math.min(Math.max(b.x, area.x), area.x + area.width - width);
  const y = Math.min(Math.max(b.y, area.y), area.y + area.height - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function setBounds(b) {
  win.setBounds(fitOnScreen(b));
  state.bounds = win.getBounds();
  save();
}

function resizeTo(width) {
  const b = win.getBounds();
  setBounds({ ...b, width, height: Math.round(aspect ? width / aspect : width * 0.75) });
}

function menu() {
  return Menu.buildFromTemplate([
    { label: '사무실 보기', type: 'radio', checked: !state.bare, click: () => { state.bare = false; save(); win.loadURL(officeURL()); } },
    { label: '가구만 보기 (바닥·벽 없음)', type: 'radio', checked: state.bare, click: () => { state.bare = true; save(); win.loadURL(officeURL()); } },
    { type: 'separator' },
    { label: '작게', click: () => resizeTo(560) },
    { label: '보통', click: () => resizeTo(900) },
    { label: '크게', click: () => resizeTo(1300) },
    { type: 'separator' },
    {
      label: '클릭 통과 (마우스가 뒤로 지나감)', type: 'checkbox', checked: clickThrough,
      click: () => { clickThrough = !clickThrough; win.setIgnoreMouseEvents(clickThrough, { forward: true }); },
    },
    { label: '새로고침', click: () => retry() },
    { label: '브라우저에서 열기', click: () => shell.openExternal(`http://localhost:${PORT}`) },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
}

async function retry() {
  await ensureServer();
  win.loadURL(officeURL());
}

function createWindow() {
  const start = state.bounds || (() => {
    const a = screen.getPrimaryDisplay().workArea;
    return { x: a.x + a.width - 920, y: a.y + a.height - 700, width: 900, height: 680 };
  })();
  win = new BrowserWindow({
    ...fitOnScreen(start),
    transparent: true, frame: false, resizable: false, hasShadow: false,
    skipTaskbar: true, alwaysOnTop: true, show: false,
    backgroundColor: '#00000000',
    title: 'Floating Office',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.once('ready-to-show', () => win.showInactive());
  // Links from the page open in the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('did-fail-load', () => setTimeout(retry, 2000));
  win.on('moved', () => { state.bounds = win.getBounds(); save(); });
  ensureServer().then(() => win.loadURL(officeURL()));
}

// ---- messages from the page (preload.js)
let drag = null;
ipcMain.on('drag-start', () => { drag = { cur: screen.getCursorScreenPoint(), b: win.getBounds(), mode: 'move' }; });
ipcMain.on('resize-start', () => { drag = { cur: screen.getCursorScreenPoint(), b: win.getBounds(), mode: 'resize' }; });
ipcMain.on('drag-move', () => {
  if (!drag) return;
  const p = screen.getCursorScreenPoint();
  const dx = p.x - drag.cur.x, dy = p.y - drag.cur.y;
  if (drag.mode === 'move') {
    win.setPosition(drag.b.x + dx, drag.b.y + dy);
  } else {
    const width = Math.max(320, drag.b.width + dx);
    win.setBounds({ ...drag.b, width, height: Math.round(aspect ? width / aspect : Math.max(240, drag.b.height + dy)) });
  }
});
ipcMain.on('drag-end', () => {
  if (!drag) return;
  drag = null;
  setBounds(win.getBounds());
});
ipcMain.on('menu', () => menu().popup({ window: win }));
// The page reports the room's shape; keep the window the same shape.
ipcMain.on('aspect', (_e, a) => {
  if (!(a > 0.3 && a < 4) || Math.abs(a - aspect) < 0.01) return;
  aspect = a;
  const b = win.getBounds();
  setBounds({ ...b, height: Math.round(b.width / a) });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.showInactive(); win.moveTop(); } });
  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock.hide();
    createWindow();
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Floating Office');
    tray.on('click', () => tray.popUpContextMenu(menu()));
    tray.on('right-click', () => tray.popUpContextMenu(menu()));
    // If the server stops, bring it back.
    setInterval(async () => { if (!(await ping())) retry(); }, 10_000);
  });
  app.on('window-all-closed', () => app.quit());
}
