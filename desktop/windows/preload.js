// Runs inside the office page: window dragging, the resize grip, the hover
// frame, the right-click menu, and the room-shape message the page sends.
const { contextBridge, ipcRenderer } = require('electron');

// office.js posts the room's aspect ratio here (same API as the Mac app).
contextBridge.exposeInMainWorld('webkit', {
  messageHandlers: { aspect: { postMessage: (a) => ipcRenderer.send('aspect', Number(a)) } },
});

const INTERACTIVE = '#fo-grip, button, input, select, textarea, a, label, [role="button"], header, .side, .side-tab, .legend, .float-stats, .conn';

window.addEventListener('DOMContentLoaded', () => {
  const css = document.createElement('style');
  css.textContent = `
    #fo-frame { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; border-radius: 14px;
      border: 2px solid #6b4a3a; background: rgba(255,255,255,.35); opacity: 0; transition: opacity .2s; }
    #fo-grip { position: fixed; right: 2px; bottom: 2px; width: 30px; height: 30px; z-index: 2147483001;
      cursor: nwse-resize; opacity: 0; transition: opacity .2s;
      background: linear-gradient(135deg, transparent 0 46%, #6b4a3a 46% 52%, transparent 52% 64%, #6b4a3a 64% 70%, transparent 70% 82%, #6b4a3a 82% 88%, transparent 88%); }
    html:hover #fo-frame, html:hover #fo-grip { opacity: 1; }`;
  document.head.appendChild(css);
  const frame = document.createElement('div'); frame.id = 'fo-frame';
  const grip = document.createElement('div'); grip.id = 'fo-grip';
  document.body.append(frame, grip);

  // Pointer capture keeps events coming even when the cursor outruns the window.
  let start = null, moved = false, swallowClick = false;
  const begin = (e, kind) => {
    start = { x: e.screenX, y: e.screenY, kind };
    moved = false;
    e.target.setPointerCapture(e.pointerId);
  };
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    begin(e, 'resize');
    ipcRenderer.send('resize-start');
    moved = true;
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || start || e.target.closest(INTERACTIVE)) return;
    begin(e, 'move');
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (!moved && Math.hypot(e.screenX - start.x, e.screenY - start.y) > 4) {
      moved = true;
      ipcRenderer.send('drag-start');
    }
    if (moved) ipcRenderer.send('drag-move');
  }, true);
  const end = () => {
    if (!start) return;
    if (moved) { ipcRenderer.send('drag-end'); swallowClick = start.kind === 'move'; }
    start = null;
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);
  // A drag shouldn't also count as a click on a character.
  document.addEventListener('click', (e) => {
    if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); }
  }, true);

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, textarea')) return;
    e.preventDefault();
    ipcRenderer.send('menu');
  });
});
