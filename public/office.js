// Isometric office: agents that are working sit at cubicle desks; a few that
// are off duty wander between the pantry, lounge, meeting room and ping-pong
// table. Plain canvas 2D with local provider logos, no dependencies.
(() => {
  'use strict';

  const TW = 64; // tile width px
  const TH = 32; // tile height px; one z unit is TH px too
  const WALL_H = 2.4;
  const WORKING = new Set(['thinking', 'tool', 'typing', 'waiting', 'error']);
  const MAX_WANDERERS = 30;
  const SPEED = 2.1; // tiles / second

  const SKIN = ['#f3cfb0', '#e5b38f', '#c98d66', '#9a6646', '#6e4630', '#f7dcc7'];
  const HAIR = ['#2a2019', '#4b3020', '#8a4b2a', '#c99a5b', '#1c1c1c', '#8c8c8c', '#a33a2c', '#3d3550'];
  const SHIRT = {
    claude: ['#c96442', '#d9825f', '#b4553a', '#e09a72'],
    codex: ['#10a37f', '#2bb38f', '#0d8a6b', '#4cc3a0'],
    gemini: ['#4f7cf0', '#6b8ff5', '#3d66d6', '#8aa6f8'],
    copilot: ['#8f5cf5', '#a06af7', '#7a47d5', '#c5a4ff'],
    omp: ['#a96926', '#c78942', '#8d531e', '#dca45c'],
    antigravity: ['#0ea5e9', '#38bdf8', '#0284c7', '#7dd3fc'],
    opencode: ['#2f6fd0', '#4a86e0', '#2559b0', '#7aa5ee'],
    hermes: ['#b4622d', '#d07c44', '#96501f', '#e2a374'],
  };
  // Official product icons, shared by both renderers and the page UI (OMP: a neutral monogram).
  // Load once per page from the same origin so video capture stays readable.
  // Initials remain a fallback if an image cannot be loaded.
  const AGENT_BADGES = {
    claude: { label: 'Claude', short: 'Cl', color: '#c96442', logo: '/assets/agents/claude.png' },
    codex: { label: 'Codex', short: 'Cx', color: '#10a37f', logo: '/assets/agents/codex.png' },
    gemini: { label: 'Gemini', short: 'G', color: '#4f7cf0', logo: '/assets/agents/gemini.png' },
    copilot: { label: 'Copilot', short: 'Co', color: '#8f5cf5', logo: '/assets/agents/copilot.svg', mono: true },
    kimi: { label: 'Kimi Code', short: 'Ki', logo: '/assets/agents/kimi.svg', mono: true },
    dsh: { label: 'DSH', short: 'Ds', logo: '/assets/agents/dsh.svg' },
    grok: { label: 'Grok Build', short: 'Gr', logo: '/assets/agents/grok.svg', mono: true },
    omp: { label: 'OMP', short: 'OMP', color: '#a96926', logo: '/assets/agents/omp.svg' },
    antigravity: { label: 'Antigravity', short: 'Ag', color: '#0ea5e9', logo: '/assets/agents/antigravity.png' },
    opencode: { label: 'OpenCode', short: 'Oc', color: '#2f6fd0', logo: '/assets/agents/opencode.svg', mono: true },
    hermes: { label: 'Hermes', short: 'He', color: '#b4622d', logo: '/assets/agents/hermes.svg', mono: true },
  };
  for (const badge of Object.values(AGENT_BADGES)) {
    badge.image = new Image();
    badge.image.src = badge.logo;
  }
  const PANTS = ['#34405a', '#2c2c34', '#4a3f35', '#3b4a3f'];
  const PANEL = ['#b9d0f2', '#f7c1b4', '#bfe3c4', '#f6dd9c'];

  const STATUS_COLOR = {
    thinking: '#8b6be6', tool: '#3b8ee0', typing: '#22a874', waiting: '#e09412',
    done: '#5f9a4c', error: '#de4b40', interrupted: '#9b9a94', idle: '#9b9a94',
  };

  const ACT_EMOJI = {
    coffee: '☕', water: '💧', fridge: '🍎', sink: '🫧', stool: '💬', couch: '💬', beanbag: '🎧',
    window: '☁️', read: '📖', whiteboard: '✏️', meeting: '💬', arcade: '🎮', pingpong: '🏓', plant: '🌱',
    vending: '🥤', foosball: '⚽', phone: '📞', pet: '💕',
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pick = (arr, h, salt) => arr[(Math.imul(h ^ Math.imul(salt, 2654435761), 2246822519) >>> 0) % arr.length];
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ?bare=1 (floating window): no floor or walls, just furniture and characters.
  const BARE = new URLSearchParams(location.search).get('bare') === '1';
  const FLOATWIN = new URLSearchParams(location.search).get('float') === '1';

  // ---- Work phase shown above a working agent ----
  // Turns status + current tool ("Bash: npm test", "Edit app.css", ...) into a
  // human phase like 기획 중 / 디자인 중 / 개발 중 / 검수 중.
  const DESIGN_EXT = /\.(css|scss|sass|less|svg|png|jpe?g|webp|gif|fig|sketch|html?)\b|design|figma|style|theme|color|font/i;
  // Emoji are measured and drawn differently by each browser engine (Safari draws
  // some wider than it measures), so each icon is drawn once, trimmed to its
  // visible pixels, and then placed as an image in a fixed square.
  const ICON_CACHE = new Map();
  function emojiIcon(e) {
    if (ICON_CACHE.has(e)) return ICON_CACHE.get(e);
    const S = 64, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.font = '44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.fillText(e, S / 2, S / 2 + 2);
    const d = g.getImageData(0, 0, S, S).data;
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (d[(y * S + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const icon = x1 < 0 ? null : { cv, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    ICON_CACHE.set(e, icon);
    return icon;
  }

  function workPhase(s) {
    const st = s.status, a = String(s.activity || ''), al = a.toLowerCase();
    if (st === 'waiting') return { icon: '🙋', text: '확인 요청' };
    if (st === 'error') return { icon: '😵', text: '막힘' };
    if (st === 'typing') return { icon: '✍️', text: '보고 중' };
    if (st === 'thinking') return { icon: '💭', text: '기획 중' };
    if (st !== 'tool') return null;
    const tool = al.split(/[:\s·]/)[0];
    if (/^(read|grep|glob|ls|search|websearch|webfetch|fetch|find|view|list|cat)/.test(tool) || /search|fetch|get_page_text|read_page|query/.test(al)) return { icon: '🔍', text: '조사 중' };
    if (/^(task|agent|subagent)/.test(tool)) return { icon: '🤝', text: '협업 중' };
    if (/^(todo|plan|update_plan|exitplanmode|enterplanmode)/.test(tool) || /update_plan|todo/.test(al)) return { icon: '📝', text: '기획 중' };
    if (/^(edit|write|multiedit|apply_patch|notebookedit|patch|create|str_replace)/.test(tool) || /apply_patch/.test(al))
      return DESIGN_EXT.test(a) ? { icon: '🎨', text: '디자인 중' } : { icon: '💻', text: '개발 중' };
    if (/screenshot|playwright|browser|preview|simulator|zoom|computer/.test(al)) return { icon: '👀', text: '화면 검수 중' };
    if (/generate_image|image|draw|render/.test(al)) return { icon: '🎨', text: '디자인 중' };
    if (/\b(test|tests|jest|vitest|pytest|lint|eslint|tsc|typecheck|check|verify|--check|spec)\b/.test(al)) return { icon: '✅', text: '검수 중' };
    if (/\b(git (commit|push)|gh pr|deploy|publish|release|vercel|wrangler)\b/.test(al)) return { icon: '🚀', text: '배포 중' };
    if (/\b(install|brew|pip|npm i|yarn add|pnpm add|setup|mkdir|clone)\b/.test(al)) return { icon: '🔧', text: '세팅 중' };
    if (/\b(build|compile|swiftc|make|bundle)\b/.test(al)) return { icon: '🏗️', text: '빌드 중' };
    if (/^(bash|shell|exec|exec_command|run|terminal)/.test(tool)) return { icon: '⚙️', text: '작업 중' };
    return { icon: '⚙️', text: '작업 중' };
  }

  // ---- Custom character sprites ----
  // Your own sheets go in assets/chars/ with a chars.json listing them; without
  // one, the example characters in assets/chars-example/ are used. Each entry is
  // a direction sheet + walk sheet, 4 columns x `rows` rows, on a transparent or
  // white background. Direction columns: front, facing left, facing right, back.
  // Walk columns: 4 frames walking toward the left. See CHARACTERS.md.
  // Turn custom characters off (back to the built-in little people) with
  // { "enabled": false } in assets/chars/chars.json.
  const SPRITE_H = 38; // on-screen height in px at scale 1
  const SPRITE_RES = 8; // pre-render sprites this many times larger so zoomed-in views stay sharp
  // Floating window: characters a bit bigger than the furniture, and labels drawn
  // in screen pixels so they stay readable at any window size.
  const CHAR_BOOST = FLOATWIN ? 1.55 : 1;
  const CHARS = []; // [{ front, left, right, back, walk: [4] }]
  // Cut a whole sheet into characters by connected shapes (not a fixed grid),
  // so a neighbour's feet never end up in a cell and nothing gets clipped.
  function cutSheet(img, rows) {
    const W = img.width, H = img.height, N = W * H;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const im = g.getImageData(0, 0, W, H), d = im.data;
    // Outline pixels (dark-ish), thickened by 2px so the background fill can't
    // squeeze through tiny gaps in a line and hollow out a white body.
    const dark = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      const i = k * 4;
      if (d[i + 3] > 128 && d[i] + d[i + 1] + d[i + 2] < 560) dark[k] = 1;
    }
    const wall = new Uint8Array(N);
    const R = 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!dark[y * W + x]) continue;
      for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++)
        for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) wall[yy * W + xx] = 1;
    }
    // Background = transparent or near-white. (The sheets come with transparent
    // backgrounds, and sometimes transparent bodies too; enclosed ones get filled.)
    // White fur is part of the body (dashed fur outlines would let a white-based fill leak in).
    const anyTransparent = (() => { for (let k = 3; k < d.length; k += 4 * 97) if (d[k] < 128) return true; return false; })();
    const light = anyTransparent
      ? (k) => d[k * 4 + 3] < 128
      : (k) => { const i = k * 4; return d[i] > 215 && d[i + 1] > 215 && d[i + 2] > 215; };
    const bg = new Uint8Array(N);
    const stack = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const k = stack.pop();
      if (bg[k] || wall[k] || !light(k)) continue;
      bg[k] = 1;
      const x = k % W;
      if (x > 0) stack.push(k - 1);
      if (x < W - 1) stack.push(k + 1);
      if (k >= W) stack.push(k - W);
      if (k < N - W) stack.push(k + W);
    }
    // Eat back the 2px white halo just outside the outlines.
    for (let it = 0; it < R + 1; it++) {
      const add = [];
      for (let k = 0; k < N; k++) {
        if (bg[k] || dark[k] || !light(k)) continue;
        const x = k % W;
        if ((x > 0 && bg[k - 1]) || (x < W - 1 && bg[k + 1]) || (k >= W && bg[k - W]) || (k < N - W && bg[k + W])) add.push(k);
      }
      for (const k of add) bg[k] = 1;
    }
    // Label the remaining shapes.
    const lab = new Int32Array(N).fill(-1);
    const comps = [];
    for (let s0 = 0; s0 < N; s0++) {
      if (bg[s0] || lab[s0] >= 0) continue;
      const id = comps.length, c = { id, n: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 };
      lab[s0] = id; stack.push(s0);
      while (stack.length) {
        const k = stack.pop(), x = k % W, y = (k / W) | 0;
        c.n++; c.sx += x; c.sy += y;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        const nb = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k >= W ? k - W : -1, k < N - W ? k + W : -1];
        for (const q of nb) if (q >= 0 && !bg[q] && lab[q] < 0) { lab[q] = id; stack.push(q); }
      }
      comps.push(c);
    }
    // Biggest shape in each grid cell is that character; nearby smaller
    // shapes (a detached tail, a puff of fur) join it, specks are dropped.
    const cw = W / 4, chh = H / rows;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let col = 0; col < 4; col++) cells.push({ r, col, parts: [] });
    const big = comps.filter((c) => c.n > 3000);
    for (const c of big) {
      const col = clamp(Math.floor(c.sx / c.n / cw), 0, 3), r = clamp(Math.floor(c.sy / c.n / chh), 0, rows - 1);
      cells[r * 4 + col].parts.push(c);
    }
    for (const cell of cells) cell.parts.sort((a, b) => b.n - a.n);
    for (const c of comps) {
      if (c.n <= 3000 && c.n > 40) {
        // attach to the closest main shape if it sits right next to it
        let best = null, bd = 14;
        for (const cell of cells) {
          const m = cell.parts[0]; if (!m) continue;
          const dx = Math.max(m.x0 - c.x1, c.x0 - m.x1, 0), dy = Math.max(m.y0 - c.y1, c.y0 - m.y1, 0);
          const dd = Math.max(dx, dy);
          if (dd < bd) { bd = dd; best = cell; }
        }
        if (best) best.parts.push(c);
      }
    }
    return cells.map((cell) => {
      const main = cell.parts[0];
      if (!main) return null;
      const keep = new Set(cell.parts.filter((c, i) => i === 0 || c.n < 3000 || c.n > main.n * 0.15).map((c) => c.id));
      let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
      for (const c of cell.parts) if (keep.has(c.id)) {
        x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1);
        if (c === main) area = c.n;
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      const o = out.getContext('2d');
      const oi = o.createImageData(w, h);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y * W + x;
        if (!keep.has(lab[k])) continue;
        const si = k * 4, di = ((y - y0) * w + (x - x0)) * 4, a = d[si + 3] / 255;
        // Composite over white so see-through bodies become solid.
        oi.data[di] = d[si] * a + 255 * (1 - a); oi.data[di + 1] = d[si + 1] * a + 253 * (1 - a);
        oi.data[di + 2] = d[si + 2] * a + 250 * (1 - a); oi.data[di + 3] = 255;
      }
      o.putImageData(oi, 0, 0);
      return { cv: out, area };
    });
  }
  // Same pixels-to-screen ratio for every frame of a character (no size jumps),
  // and every character's body area brought to the same on-screen size.
  function finishChar(cells) {
    const front = cells[0];
    // Direction and walk frames come from different sheets drawn at slightly
    // different sizes, so each set is normalised on its own body area.
    const refArea = (list) => { const a = list.filter(Boolean).map((c) => c.area); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : front.area; };
    const kDir = (SPRITE_H * 0.82) / Math.sqrt(refArea(cells.slice(0, 4))) * SPRITE_RES;
    const kWalk = (SPRITE_H * 0.82) / Math.sqrt(refArea(cells.slice(4))) * SPRITE_RES;
    let k = kDir;
    const shrink = (c, i) => {
      k = i >= 4 ? kWalk : kDir;
      if (!c) return front.cv;
      const out = document.createElement('canvas');
      // Never upscale past the source drawing; remember the on-screen size separately.
      const kk = Math.min(k, 1);
      out.width = Math.max(1, Math.round(c.cv.width * kk)); out.height = Math.max(1, Math.round(c.cv.height * kk));
      out.dw = c.cv.width * k / SPRITE_RES; out.dh = c.cv.height * k / SPRITE_RES;
      const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
      o.drawImage(c.cv, 0, 0, out.width, out.height);
      return out;
    };
    return { front: shrink(cells[0], 0), left: shrink(cells[1], 1), right: shrink(cells[2], 2), back: shrink(cells[3], 3), walk: cells.slice(4).map((c, i) => shrink(c, 4 + i)) };
  }
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`can't load ${src}`)); i.src = src; });
  }
  async function spriteConfig() {
    for (const base of ['/assets/chars/', '/assets/chars-example/']) {
      const r = await fetch(base + 'chars.json').catch(() => null);
      if (!r || !r.ok) continue;
      const cfg = await r.json();
      if (cfg.enabled === false) return [];
      return (cfg.sheets || []).map((s) => ({ dir: base + s.dir, walk: base + s.walk, rows: s.rows || 1 }));
    }
    return [];
  }
  const spritesReady = spriteConfig().then((sheets) => Promise.all(sheets.map(async (s) => {
    const [dir, walk] = await Promise.all([loadImg(s.dir), loadImg(s.walk)]);
    const dc = cutSheet(dir, s.rows), wc = cutSheet(walk, s.rows);
    const list = [];
    for (let r = 0; r < s.rows; r++) list.push(finishChar([...dc.slice(r * 4, r * 4 + 4), ...wc.slice(r * 4, r * 4 + 4)]));
    return list;
  }))).then((groups) => { for (const g of groups) CHARS.push(...g); }).catch((e) => console.error('sprites', e));

  function palette() {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    return dark ? {
      dark: true,
      wood1: '#4a3f35', wood2: '#453a31', woodLine: 'rgba(0,0,0,.22)',
      tileA: '#3d4044', tileB: '#35383c', carpet: '#33404d', carpetLine: 'rgba(255,255,255,.04)',
      wallL: '#4a4640', wallR: '#3f3b36', wallTop: '#5a554e', trim: '#2b2926',
      deskTop: '#8a6a4c', deskL: '#6e533b', deskR: '#5c4431',
      monitor: '#18181a', screenOff: '#26282c', chair: '#2d2d32',
      rug: '#47544f', rugEdge: '#3a4541', couch: '#5b6b8c', couchD: '#4a587a',
      counter: '#d9d4c9', counterL: '#a9a397', counterR: '#958f84', metal: '#8d939a',
      glass: 'rgba(160,200,230,.10)', glassEdge: 'rgba(190,220,240,.35)', mat: '#2f4a3a',
      text: '#ecebe6', tagBg: 'rgba(20,20,19,.78)', bubble: '#f4f3ee', bubbleInk: '#1c1c1a',
      plant: '#4f8a52', pot: '#9a5b3c', shadow: 'rgba(0,0,0,.28)', book: ['#c96442', '#3b8ee0', '#5f9a4c', '#c9a24c', '#8b6be6'],
    } : {
      dark: false, cute: true, ink: '#6b4a3a',
      wood1: '#fbe3cf', wood2: '#f7d8c2', woodLine: 'rgba(160,110,80,.10)',
      tileA: '#fff7ec', tileB: '#fde3e6', carpet: '#d8ecf7', carpetLine: 'rgba(120,160,190,.10)',
      wallL: '#fff3e4', wallR: '#fde6df', wallTop: '#fffaf3', trim: '#e9c9b4',
      deskTop: '#f6d5a8', deskL: '#e8bf8c', deskR: '#dcae7a',
      monitor: '#7a6a7e', screenOff: '#a99bb0', chair: '#f2b8c6',
      rug: '#d6efd9', rugEdge: '#a8d3b0', couch: '#b9d4f4', couchD: '#9fbfe6',
      counter: '#fffdf8', counterL: '#f1e2d2', counterR: '#e7d3c1', metal: '#d8d4e4',
      glass: 'rgba(190,225,245,.22)', glassEdge: 'rgba(140,180,210,.55)', mat: '#cdeccf',
      text: '#5b4032', tagBg: 'rgba(255,252,246,.94)', bubble: '#fffdf8', bubbleInk: '#5b4032',
      plant: '#8fd19a', pot: '#f4a9a0', shadow: 'rgba(120,80,60,.14)', book: ['#f7a6b8', '#a7c8f2', '#b5e0b0', '#f8d98b', '#cdb6f0'],
    };
  }

  function skyColor(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17) return { sky: '#a9d4f2', night: false };
    if (h >= 5 && h < 7) return { sky: '#f3c9a8', night: false };
    if (h >= 17 && h < 19) return { sky: '#f0a679', night: false };
    return { sky: '#1d2747', night: true };
  }

  // ---------------------------------------------------------------- A* grid

  class Grid {
    constructor(W, D, res = 4) {
      this.res = res;
      this.cw = Math.ceil(W * res);
      this.ch = Math.ceil(D * res);
      this.cost = new Uint8Array(this.cw * this.ch);
    }
    block(x, y, w, d, pad = 0.12) {
      const R = this.res;
      const i0 = clamp(Math.floor((x - pad) * R), 0, this.cw - 1);
      const i1 = clamp(Math.ceil((x + w + pad) * R) - 1, 0, this.cw - 1);
      const j0 = clamp(Math.floor((y - pad) * R), 0, this.ch - 1);
      const j1 = clamp(Math.ceil((y + d + pad) * R) - 1, 0, this.ch - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.cost[j * this.cw + i] = 1;
    }
    blocked(x, y) {
      const i = Math.floor(x * this.res), j = Math.floor(y * this.res);
      if (i < 0 || j < 0 || i >= this.cw || j >= this.ch) return true;
      return !!this.cost[j * this.cw + i];
    }
    path(ax, ay, bx, by) {
      const R = this.res, cw = this.cw, ch = this.ch;
      const si = clamp(Math.floor(ax * R), 0, cw - 1), sj = clamp(Math.floor(ay * R), 0, ch - 1);
      const gi = clamp(Math.floor(bx * R), 0, cw - 1), gj = clamp(Math.floor(by * R), 0, ch - 1);
      const N = cw * ch;
      const g = new Float32Array(N).fill(Infinity);
      const came = new Int32Array(N).fill(-1);
      const closed = new Uint8Array(N);
      const heap = [];
      const push = (f, n) => {
        heap.push([f, n]);
        let k = heap.length - 1;
        while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let k = 0;
          for (;;) {
            const l = 2 * k + 1, r = l + 1;
            let m = k;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === k) break;
            [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
          }
        }
        return top;
      };
      const hfn = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
      // Blocked cells are expensive, not impossible, so a path always exists
      // (someone standing right against furniture can still step away).
      const stepCost = (n) => (this.cost[n] ? 25 : 1);
      const start = sj * cw + si, goal = gj * cw + gi;
      g[start] = 0;
      push(hfn(si, sj), start);
      const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
      while (heap.length) {
        const [, n] = pop();
        if (n === goal) break;
        if (closed[n]) continue;
        closed[n] = 1;
        const i = n % cw, j = (n / cw) | 0;
        for (const [di, dj, c] of dirs) {
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cw || nj >= ch) continue;
          if (di && dj && (this.cost[j * cw + ni] || this.cost[nj * cw + i])) continue;
          const nn = nj * cw + ni;
          const ng = g[n] + c * stepCost(nn);
          if (ng < g[nn]) { g[nn] = ng; came[nn] = n; push(ng + hfn(ni, nj), nn); }
        }
      }
      const cells = [];
      for (let n = goal; n !== -1 && n !== start; n = came[n]) cells.push(n);
      cells.reverse();
      const pts = [];
      let lastDir = null;
      for (let k = 0; k < cells.length; k++) {
        const n = cells[k];
        const dir = n - (k ? cells[k - 1] : start);
        const pt = { x: ((n % cw) + 0.5) / R, y: (((n / cw) | 0) + 0.5) / R };
        if (dir === lastDir && pts.length) pts[pts.length - 1] = pt;
        else pts.push(pt);
        lastDir = dir;
      }
      if (pts.length) pts[pts.length - 1] = { x: bx, y: by };
      else pts.push({ x: bx, y: by });
      return pts;
    }
  }

  // ---------------------------------------------------------------- office

  class Office {
    constructor(root, { onHover, label, onFrame, showAgent = true, compact = false } = {}) {
      this.root = root;
      this.onHover = onHover || (() => {});
      this.label = label || ((s) => s.project || s.agent);
      this.onFrame = onFrame;
      this.showAgent = showAgent;
      this.compact = compact;
      this.offDutyLabel = 'went home';
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'office-canvas';
      root.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.people = new Map();
      this.deskOf = new Map();
      this.offDuty = 0;
      this.first = true;
      this.visible = true;
      this.hit = [];
      this.hoverKey = null;
      this.t = performance.now();
      this.pal = palette();
      this.plan = this.buildPlan(0);
      // Two office cats: the ginger one and a calico.
      this.cats = [
        { x: this.plan.W - 3, y: this.plan.D - 2, path: [], until: 0, face: 1, coat: 'ginger' },
        { x: 3, y: this.plan.D - 3, path: [], until: 3000, face: -1, coat: 'calico' },
      ];
      this.cat = this.cats[0];
      this.theme = matchMedia('(prefers-color-scheme: dark)');
      this.onTheme = () => (this.pal = palette());
      this.theme.addEventListener('change', this.onTheme);

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(root);
      this.canvas.addEventListener('mousemove', (e) => this.pointer(e));
      this.canvas.addEventListener('click', (e) => this.pointer(e, true));
      this.canvas.addEventListener('mouseleave', () => { this.hoverKey = null; this.onHover(null); });
      this.resize();
      this.last = performance.now();
      // Resolves true once a few frames have been drawn with data in place,
      // false if the renderer gave up (3D load failure).
      this.ready = new Promise((ok) => (this.markReady = ok));
      this.framesShown = 0;
      const loop = (t) => { if (this.dead) return; this.frame(t); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }

    destroy() {
      this.dead = true;
      cancelAnimationFrame(this.raf);
      this.ro.disconnect();
      this.theme.removeEventListener('change', this.onTheme);
      this.canvas.remove();
    }

    // ------------------------------------------------------------ floor plan

    buildPlan(nWorking) {
      const pal = this.pal;
      const pods = Math.max(2, Math.ceil((nWorking + 2) / 4));
      const podCols = pods <= 4 ? 2 : 3;
      const podRows = Math.ceil(pods / podCols);
      const OW = 1.3 + (podCols - 1) * 4.2 + 3.9; // open office width
      const OD = podRows * 4.7 + 0.8;             // open office depth (pods)
      const D = Math.max(OD + 3.6, 14.5);
      const RW = 7.2;                              // right column width
      const W = OW + RW;
      const MR = 5.2;                              // meeting room depth
      const PY = 9.9;                              // pantry / lounge boundary
      const grid = new Grid(W, D);
      const items = [];
      const pois = [];
      const desks = [];
      const add = (depth, draw) => items.push({ depth, draw });
      // Semantic list of what is where, for renderers that don't use the 2D
      // draw closures (the 3D view).
      const props = [];
      const prop = (t, o) => props.push({ t, ...o });
      const solid = (x, y, w, d, pad) => grid.block(x, y, w, d, pad);
      const poi = (x, y, act, face, opt = {}) => pois.push({ x, y, act, face, sit: 0, ...opt });

      // Long boxes are split into ~1 tile pieces so depth sorting against
      // people stays right along their length. `extra(x0, x1)` draws things on
      // the front face of each piece (books on a shelf, etc).
      const longBox = (x, y, z, w, d, h, top, left, right, opts = {}) => {
        const n = Math.max(1, Math.ceil(Math.max(w, d) / 0.9));
        for (let k = 0; k < n; k++) {
          const sx = w >= d ? x + (w / n) * k : x, sy = w >= d ? y : y + (d / n) * k;
          const sw = w >= d ? w / n : w, sd = w >= d ? d : d / n;
          add(sx + sw / 2 + sy + sd / 2 + (opts.bias || 0), () => {
            this.box(sx, sy, z, sw, sd, h, top, left, right);
            if (opts.extra) opts.extra(sx, sx + sw);
          });
        }
      };

      // ---- cubicle pods: 4 desks back to back with a divider
      const pod = (px, py, panel) => {
        for (let k = 0; k < 2; k++) {
          const x = px + k * 1.5;
          desks.push({ x, y: py, side: 'n', seat: { x: x + 0.7, y: py - 0.45 } });
          desks.push({ x, y: py + 0.92, side: 's', seat: { x: x + 0.7, y: py + 0.92 + 1.25 } });
          solid(x, py, 1.4, 0.8, 0.08);
          solid(x, py + 0.92, 1.4, 0.8, 0.08);
        }
        longBox(px - 0.1, py + 0.82, 0, 3.15, 0.08, 1.15, this.shade(panel, 25), panel, this.shade(panel, -15), { bias: 0.05 });
        prop('panel', { x: px - 0.1, y: py + 0.82, w: 3.15, d: 0.08, h: 1.15, color: panel });
        prop('panel', { x: px - 0.18, y: py - 0.05, w: 0.08, d: 1.82, h: 1.15, color: panel });
        add(px - 0.1 + py + 0.86, () => this.box(px - 0.18, py - 0.05, 0, 0.08, 1.82, 1.15, this.shade(panel, 25), panel, this.shade(panel, -15)));
        solid(px - 0.18, py + 0.8, 3.25, 0.12, 0.05);
      };
      for (let p = 0; p < pods; p++) {
        const c = p % podCols, r = Math.floor(p / podCols);
        pod(1.3 + c * 4.2, 2.0 + r * 4.7, PANEL[p % PANEL.length]);
      }
      // A smaller meeting room leaves room for one more pod next to it.
      const GX = OW + 3.6;                         // meeting room starts here
      pod(OW + 0.45, 2.0, PANEL[pods % PANEL.length]);

      // ---- open office extras
      const rx = OW - 1.15;
      add(rx + 0.35 + 0.5, () => this.serverRack(rx, 0.2));
      prop('rack', { x: rx, y: 0.2 });
      prop('printer', { x: OW - 2.3, y: 0.25 });
      solid(rx, 0.2, 0.7, 0.6);
      add(OW - 2.3 + 0.3 + 0.5, () => this.printer(OW - 2.3, 0.25));
      solid(OW - 2.3, 0.25, 0.75, 0.55);
      for (const [x, y] of [[0.45, 0.45], [0.45, OD - 0.2]]) { add(x + y, () => this.plant(x, y)); prop('plant', { x, y }); solid(x - 0.2, y - 0.2, 0.4, 0.4); }
      const windows = [];
      for (let x = 1.0; x < OW - 2.6; x += 2.4) {
        windows.push(x);
        poi(x + 0.75, 0.75, 'window', 'back');
      }
      poi(0.95, OD - 0.2, 'plant', 'back');

      // ---- ping-pong corner
      const tx = 2.4, ty = OD + 1.0;
      add(tx + 1.3 + ty + 0.7, () => this.pingpong(tx, ty));
      prop('pingpong', { x: tx, y: ty });
      solid(tx, ty, 2.6, 1.4, 0.05);
      poi(tx - 0.55, ty + 0.7, 'pingpong', 'side', { pair: 'pp' });
      poi(tx + 3.15, ty + 0.7, 'pingpong', 'side', { pair: 'pp' });
      const pp = { x0: tx - 0.2, x1: tx + 2.8, y: ty + 0.7 };

      // ---- front corner: vending machines, foosball, phone booth
      const fy = OD + 3.7;
      if (D - fy >= 3.4) {
        add(0.5 + fy + 0.4, () => this.vending(0.12, fy, '#c0392b'));
        prop('vending', { x: 0.12, y: fy, color: '#c0392b' });
        prop('vending', { x: 0.12, y: fy + 0.8, color: '#2f6fb0' });
        add(0.5 + fy + 1.2, () => this.vending(0.12, fy + 0.8, '#2f6fb0'));
        solid(0.1, fy, 0.75, 1.55);
        poi(1.3, fy + 0.4, 'vending', 'back');
        poi(1.3, fy + 1.2, 'vending', 'back');
      }
      if (D - fy >= 2.2) {
        const fx = 3.0, fby = fy + 0.4;
        add(fx + 0.8 + fby + 0.4, () => this.foosball(fx, fby));
        prop('foosball', { x: fx, y: fby });
        solid(fx, fby, 1.6, 0.8, 0.05);
        poi(fx - 0.45, fby + 0.4, 'foosball', 'side', { pair: 'fb' });
        poi(fx + 2.05, fby + 0.4, 'foosball', 'side', { pair: 'fb' });
        const bx = OW - 2.0, by = fy;
        this.booth(add, bx, by);
        prop('booth', { x: bx, y: by });
        solid(bx - 0.05, by - 0.05, 1.4, 0.1, 0.03);
        solid(bx - 0.05, by - 0.05, 0.1, 1.4, 0.03);
        solid(bx + 1.25, by - 0.05, 0.1, 1.4, 0.03);
        solid(bx + 0.85, by + 1.25, 0.5, 0.1, 0.03);
        poi(bx + 0.65, by + 0.6, 'phone', 'front', { sit: 0.45 });
        add(OW - 0.45 + D - 0.6, () => this.plant(OW - 0.45, D - 0.6));
        prop('plant', { x: OW - 0.45, y: D - 0.6 });
      }

      // ---- meeting room behind glass, door at y 3.6–4.6
      const mx = OW;
      for (const [y, d] of [[0, 1], [1, 1], [2, 1], [3, 0.6], [4.6, MR - 4.6]]) this.glassX(add, GX, y, d);
      for (let x = GX; x < W - 0.01; x += 1) this.glassY(add, x, MR, Math.min(1, W - x));
      prop('glass', { x: GX, y: 0, w: 0, d: 3.6 });
      prop('glass', { x: GX, y: 4.6, w: 0, d: MR - 4.6 });
      prop('glass', { x: GX, y: MR, w: W - GX, d: 0 });
      solid(GX - 0.05, 0, 0.1, 3.6, 0.05);
      solid(GX - 0.05, 4.6, 0.1, MR - 4.6, 0.05);
      solid(GX, MR - 0.05, W - GX, 0.1, 0.05);
      const mtx = GX + 0.3, mty = 1.7;
      add(mtx + 1.5 + mty + 0.7, () => this.meetingTable(mtx, mty));
      prop('meetingTable', { x: mtx, y: mty, w: 3.0, d: 1.4 });
      solid(mtx, mty, 3.0, 1.4);
      for (let k = 0; k < 3; k++) {
        const cx = mtx + 0.5 + k * 1.0;
        add(cx + mty - 0.45, () => this.stool(cx, mty - 0.4, 0.4, '#555c66'));
        add(cx + mty + 1.78, () => this.stool(cx, mty + 1.8, 0.4, '#555c66'));
        poi(cx, mty - 0.4, 'meeting', 'front', { sit: 0.42 });
        prop('chair', { x: cx, y: mty - 0.4, face: 'front' });
        prop('chair', { x: cx, y: mty + 1.8, face: 'back' });
        poi(cx, mty + 1.8, 'meeting', 'back', { sit: 0.42 });
      }
      poi(GX + 1.7, 0.65, 'whiteboard', 'back');
      add(W - 0.45 + 0.45, () => this.plant(W - 0.45, 0.45));
      prop('plant', { x: W - 0.45, y: 0.45 });
      solid(W - 0.65, 0.25, 0.4, 0.4);

      // ---- pantry
      const cy = MR + 0.3;
      longBox(mx + 1.0, cy, 0, RW - 2.3, 0.7, 0.9, pal.counter, pal.counterL, pal.counterR, { bias: -0.5 });
      solid(mx + 1.0, cy, RW - 2.3, 0.7);
      prop('counter', { x: mx + 1.0, y: cy, w: RW - 2.3, d: 0.7 });
      prop('coffee', { x: mx + 2.4, y: cy + 0.12 });
      prop('sink', { x: mx + 3.9, y: cy + 0.12 });
      prop('fridge', { x: W - 1.15, y: cy });
      prop('cooler', { x: mx + 0.35, y: cy + 0.05 });
      add(mx + 2.65 + cy + 0.35, () => this.coffeeMachine(mx + 2.4, cy + 0.12));
      add(mx + 4.15 + cy + 0.35, () => this.sink(mx + 3.9, cy + 0.12));
      add(W - 0.75 + cy + 0.4, () => this.fridge(W - 1.15, cy));
      solid(W - 1.15, cy, 0.85, 0.75);
      add(mx + 0.55 + cy + 0.25, () => this.waterCooler(mx + 0.35, cy + 0.05));
      solid(mx + 0.3, cy, 0.5, 0.5);
      poi(mx + 2.65, cy + 1.2, 'coffee', 'back');
      poi(mx + 4.15, cy + 1.2, 'sink', 'back');
      poi(W - 0.75, cy + 1.3, 'fridge', 'back');
      poi(mx + 0.6, cy + 0.95, 'water', 'back');
      const rtx = mx + 3.6, rty = MR + 2.9;
      add(rtx + rty, () => this.roundTable(rtx, rty));
      prop('roundTable', { x: rtx, y: rty });
      solid(rtx - 0.45, rty - 0.45, 0.9, 0.9);
      for (const [sx, sy, face] of [[rtx - 1.0, rty, 'front'], [rtx + 1.0, rty, 'front'], [rtx, rty + 1.0, 'back'], [rtx, rty - 0.95, 'front']]) {
        add(sx + sy - 0.02, () => this.stool(sx, sy, 0.45, '#c9a24c'));
        poi(sx, sy, 'stool', face, { sit: 0.47 });
        prop('barStool', { x: sx, y: sy });
      }

      // ---- lounge
      const lx = mx + 0.6, ly = PY + 0.4;
      const shelfX = mx + 3.4, shelfW = RW - 3.6;
      longBox(shelfX, PY - 0.25, 0, shelfW, 0.45, 1.45, this.shade(pal.deskTop, -5), pal.deskL, pal.deskR, {
        extra: (x0, x1) => this.books(x0, x1, PY + 0.2),
      });
      solid(shelfX, PY - 0.25, shelfW, 0.45);
      prop('shelf', { x: shelfX, y: PY - 0.25, w: shelfW, d: 0.45 });
      poi(mx + 4.6, PY + 0.75, 'read', 'back');
      poi(mx + 5.8, PY + 0.75, 'read', 'back');
      add(lx + ly + 0.6, () => this.couch(lx, ly + 0.6));
      prop('couch', { x: lx, y: ly + 0.6, w: 2.8, d: 0.8 });
      prop('coffeeTable', { x: lx + 0.6, y: ly + 2.0, w: 1.6, d: 0.7 });
      prop('beanbag', { x: lx + 0.4, y: ly + 3.6, color: '#c96442' });
      prop('beanbag', { x: lx + 2.6, y: ly + 3.6, color: '#7d93c4' });
      solid(lx, ly + 0.6, 2.8, 0.8);
      for (let k = 0; k < 3; k++) poi(lx + 0.5 + k * 0.9, ly + 1.2, 'couch', 'front', { sit: 0.36 });
      add(lx + 1.4 + ly + 2.35, () => this.coffeeTable(lx + 0.6, ly + 2.0));
      solid(lx + 0.6, ly + 2.0, 1.6, 0.7);
      add(lx + 0.4 + ly + 3.6, () => this.beanbag(lx + 0.4, ly + 3.6, '#c96442'));
      add(lx + 2.6 + ly + 3.6, () => this.beanbag(lx + 2.6, ly + 3.6, '#7d93c4'));
      poi(lx + 0.4, ly + 3.6, 'beanbag', 'front', { sit: 0.18 });
      poi(lx + 2.6, ly + 3.6, 'beanbag', 'front', { sit: 0.18 });
      const ax = W - 1.2, ay = ly + 1.0;
      add(ax + 0.35 + ay + 0.35, () => this.arcade(ax, ay));
      prop('arcade', { x: ax, y: ay });
      prop('plant', { x: W - 0.5, y: D - 0.5 });
      prop('lamp', { x: lx - 0.2, y: D - 0.6 });
      prop('rug', { x: OW + 0.3, y: PY + 0.6, w: 4.0, d: D - PY - 1.0 });
      solid(ax, ay, 0.7, 0.7);
      poi(ax + 0.35, ay + 1.15, 'arcade', 'back');
      add(W - 0.5 + D - 0.5, () => this.plant(W - 0.5, D - 0.5));
      add(lx - 0.2 + D - 0.6, () => this.floorLamp(lx - 0.2, D - 0.6));

      const posters = [
        { y: 2.2, color: '#c96442', text: 'SHIP IT' },
        { y: 4.6, color: '#10a37f', text: 'TESTS ✓' },
      ];
      return { W, D, OW, OD, MR, PY, RW, GX, pods, grid, items, props, pois, desks, windows, posters, pp, door: { x: 0.4, y: D - 1.2 } };
    }

    glassX(add, x, y, d) {
      if (BARE) return;
      add(x + y + d / 2 + 0.02, () => {
        const P = (a, b, c) => this.iso(a, b, c);
        this.poly([P(x, y, 0), P(x, y + d, 0), P(x, y + d, 0.22), P(x, y, 0.22)], this.pal.trim);
        this.poly([P(x, y, 0.22), P(x, y + d, 0.22), P(x, y + d, 2.1), P(x, y, 2.1)], this.pal.glass, this.pal.glassEdge);
      });
    }

    glassY(add, x, y, w) {
      if (BARE) return;
      add(x + w / 2 + y + 0.02, () => {
        const P = (a, b, c) => this.iso(a, b, c);
        this.poly([P(x, y, 0), P(x + w, y, 0), P(x + w, y, 0.22), P(x, y, 0.22)], this.pal.trim);
        this.poly([P(x, y, 0.22), P(x + w, y, 0.22), P(x + w, y, 2.1), P(x, y, 2.1)], this.pal.glass, this.pal.glassEdge);
      });
    }

    // ------------------------------------------------------------ sessions → people

    update(sessions) {
      const working = sessions.filter((s) => WORKING.has(s.status));
      const off = sessions
        .filter((s) => !WORKING.has(s.status))
        .sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
      const wanderers = off.slice(0, MAX_WANDERERS);
      this.offDuty = off.length - wanderers.length;

      const cap = this.plan.desks.length;
      // Scene packs have a fixed floor plan; the built-in office grows with the team.
      const pods = this.plan.pods || cap / 4;
      if (!this.plan.fixed && (working.length > cap - 1 || (pods > 2 && working.length < pods * 4 * 0.35))) {
        this.plan = this.buildPlan(working.length);
        this.deskOf.clear();
        for (const p of this.people.values()) { p.poi = null; p.napDesk = null; p.desk = null; p.until = 0; }
      }

      const workKeys = new Set(working.map((s) => s.key));
      for (const k of [...this.deskOf.keys()]) if (!workKeys.has(k)) this.deskOf.delete(k);
      const used = new Set(this.deskOf.values());
      // Fill the desks that face us first so more faces and screens show.
      const desks = this.plan.desks;
      const order = desks.map((d, i) => i).sort((a, b) => (desks[a].side === 's') - (desks[b].side === 's') || a - b);
      for (const s of [...working].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))) {
        if (this.deskOf.has(s.key)) continue;
        const i = order.find((n) => !used.has(n));
        if (i == null) continue;
        this.deskOf.set(s.key, i);
        used.add(i);
      }
      const takenDesks = new Set([...this.deskOf.values()].map((i) => desks[i]));

      const shown = new Set();
      for (const s of [...working, ...wanderers]) {
        const isWorker = this.deskOf.has(s.key);
        if (!isWorker && WORKING.has(s.status)) continue; // no desk left
        shown.add(s.key);
        let p = this.people.get(s.key);
        if (!p) { p = this.newPerson(s); this.people.set(s.key, p); }
        p.s = s;
        p.leaving = false;
        if (isWorker) {
          if (p.shift) { if (p.desk && p.desk.npcWorker === p.key) p.desk.npcWorker = null; p.shift = false; }
          this.release(p);
          const desk = desks[this.deskOf.get(s.key)];
          if (p.desk !== desk || p.mode !== 'work') { p.desk = desk; this.goTo(p, desk.seat); }
          p.mode = 'work';
        } else {
          if (p.shift && p.mode === 'work') { if (!p.desk || takenDesks.has(p.desk)) this.endShift(p, Date.now()); }
          else if (p.mode !== 'wander') { p.mode = 'wander'; p.desk = null; p.poi = null; p.until = 0; p.shift = false; }
          // Someone started working at the desk this one was napping on.
          if (p.napDesk && takenDesks.has(p.napDesk)) { this.release(p); p.path = []; }
        }
      }
      // Custom characters: give each real session its own character, then let
      // every character nobody is using wander around as an extra.
      if (CHARS.length) {
        const real = [...shown].map((k) => this.people.get(k));
        const taken = new Set(real.map((p) => p.charIdx).filter((i) => i != null));
        for (const p of real) {
          if (p.charIdx != null) continue;
          let i = p.h % CHARS.length;
          for (let k = 0; k < CHARS.length && taken.has(i); k++) i = (i + 1) % CHARS.length;
          p.charIdx = i;
          taken.add(i);
        }
        for (let i = 0; i < CHARS.length; i++) {
          if (taken.has(i)) continue;
          const key = `npc:${i}`;
          shown.add(key);
          let p = this.people.get(key);
          if (!p) {
            p = this.newPerson({ key, status: 'done', npc: true, agent: 'claude', title: '' });
            p.charIdx = i;
            this.people.set(key, p);
          }
          p.leaving = false;
          if (p.mode === 'work' && (!p.desk || takenDesks.has(p.desk))) this.endShift(p, Date.now());
          else if (p.mode !== 'wander' && p.mode !== 'work') { p.mode = 'wander'; p.desk = null; p.poi = null; p.until = 0; }
        }
      }
      for (const [k, p] of this.people) {
        if (!shown.has(k) && !p.leaving) {
          p.leaving = true;
          p.mode = 'leave';
          this.release(p);
          p.desk = null;
          this.goTo(p, this.plan.door);
        }
      }
      this.first = false;
    }

    release(p) {
      if (p.poi && p.poi.cat && p.poi.cat.petBy === p.key) { p.poi.cat.petBy = null; p.poi.cat.until = Date.now() + rand(2000, 6000); }
      if (p.poi) { p.poi.taken = null; p.poi = null; }
      if (p.napDesk) { p.napDesk.napper = null; p.napDesk = null; }
    }

    newPerson(s) {
      const h = hash(s.key);
      const door = this.plan.door;
      return {
        key: s.key, h, s,
        skin: pick(SKIN, h, 3), hair: pick(HAIR, h, 7), pants: pick(PANTS, h, 13),
        shirt: pick(SHIRT[s.agent] || SHIRT.claude, h, 11),
        hairStyle: h % 4,
        phase: (h % 1000) / 1000 * Math.PI * 2,
        x: door.x, y: door.y,
        path: [], walkFace: 'front', until: 0, mode: null,
        // On the first snapshot everyone is placed directly, no stampede.
        placeOnArrive: this.first,
      };
    }

    goTo(p, target) {
      if (p.placeOnArrive) {
        p.x = target.x; p.y = target.y; p.path = []; p.placeOnArrive = false;
        return;
      }
      p.path = this.plan.grid.path(p.x, p.y, target.x, target.y);
    }

    // Extras take turns working: now and then one sits at a free desk and types
    // for a while, then goes back to wandering. Real sessions always win a desk.
    npcShifts(now) {
      if (!CHARS.length || now < (this.nextShiftCheck || 0)) return;
      this.nextShiftCheck = now + 1000;
      const desks = this.plan.desks;
      const real = new Set([...this.deskOf.values()].map((i) => desks[i]));
      const busy = new Set(real);
      // Extras, and real sessions that are idle or done (they'd only wander otherwise).
      const npcs = [...this.people.values()].filter((p) => p.s && !p.leaving && (p.s.npc || !WORKING.has(p.s.status)) && (p.mode !== 'work' || p.shift));
      for (const p of npcs) {
        if (p.mode !== 'work') continue;
        if (!p.desk || real.has(p.desk) || now > p.shiftEnd) this.endShift(p, now);
        else busy.add(p.desk);
      }
      // Keep a desk free for real sessions, and at most ~a third of the idle ones at work.
      const free = desks.filter((d) => !busy.has(d) && !d.napper && d.pose !== 'stand');
      let room = Math.min(free.length - 1, Math.ceil(npcs.length / 3) - npcs.filter((p) => p.mode === 'work').length);
      for (const p of npcs) {
        if (room <= 0) break;
        if (p.mode !== 'wander' || p.path.length || now < (p.nextShift ??= now + rand(3, 25) * 1000)) continue;
        const d = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        if (!d) break;
        this.release(p);
        if (p.napDesk) { p.napDesk.napper = null; p.napDesk = null; }
        p.mode = 'work';
        p.shift = true;
        p.desk = d;
        d.npcWorker = p.key;
        p.shiftEnd = now + rand(30, 90) * 1000;
        this.goTo(p, d.seat);
        room--;
      }
    }

    endShift(p, now) {
      if (p.desk && p.desk.npcWorker === p.key) p.desk.npcWorker = null;
      p.mode = 'wander';
      p.shift = false;
      p.desk = null; p.poi = null; p.until = 0;
      p.nextShift = now + rand(20, 60) * 1000;
    }

    wander(p, now) {
      if (p.path.length) return;
      if (p.poi && now < p.until) return;
      this.release(p);
      const plan = this.plan;
      const workingDesks = new Set([...this.deskOf.values()].map((i) => plan.desks[i]));
      const sleepy = p.s.status === 'idle';
      const weighted = [];
      for (const q of plan.pois) {
        if (q.taken) continue;
        let w = 1;
        if (q.pair) w = plan.pois.some((o) => o.pair === q.pair && o !== q && o.taken) ? 7 : 1.2;
        if (q.act === 'couch' || q.act === 'beanbag' || q.sleepy) w = sleepy ? 3 : 1.4;
        weighted.push([q, w]);
      }
      for (const d of plan.noNap ? [] : plan.desks) {
        if (workingDesks.has(d) || d.napper || d.npcWorker) continue;
        weighted.push([{ x: d.seat.x, y: d.seat.y, act: 'nap', face: d.side === 'n' ? 'front' : 'back', sit: 0.34, desk: d }, sleepy ? 3 : 0.25]);
      }
      // A resting cat nobody is petting can be petted (stand beside it).
      for (const k of this.cats || []) {
        if (k.path.length || k.petBy) continue;
        // Stand beside it on screen (same depth), not in front where the body would hide it.
        for (const [dx, dy] of [[0.75, -0.75], [-0.75, 0.75]]) {
          const sx = k.x + dx, sy = k.y + dy;
          if (sx < 0.4 || sx > plan.W - 0.4 || plan.grid.blocked(sx, sy)) continue;
          weighted.push([{ x: sx, y: sy, act: 'pet', face: 'front', cat: k }, 1.6]);
          break;
        }
      }
      if (!weighted.length) return;
      let r = Math.random() * weighted.reduce((a, [, w]) => a + w, 0);
      let choice = weighted[0][0];
      for (const [q, w] of weighted) { r -= w; if (r <= 0) { choice = q; break; } }
      if (choice.desk) { choice.desk.napper = p.key; p.napDesk = choice.desk; }
      if (choice.cat) { choice.cat.petBy = p.key; choice.cat.until = Infinity; }
      choice.taken = p.key;
      p.poi = choice;
      p.until = Infinity; // set on arrival
      p.stay = (choice.act === 'nap' ? rand(25, 60) : choice.act === 'pingpong' ? rand(15, 30) : choice.act === 'pet' ? rand(6, 12) : rand(8, 20)) * 1000;
      this.goTo(p, choice);
    }

    setVisible(v) { this.visible = v; if (v) this.resize(); }

    // Room on the right covered by an overlay (the agent panel). The canvas
    // keeps its size; the view eases over so the room stays centred in what
    // is still visible, instead of the canvas resizing under the slide.
    setInset(px, animate = true) {
      const now = performance.now();
      this.insetFrom = animate ? this.inset(now) : px;
      this.insetTo = px;
      this.insetT0 = animate ? now : -Infinity;
    }
    inset(now = performance.now()) {
      if (this.insetTo == null) return 0;
      const k = Math.min(1, (now - this.insetT0) / 340);
      const e = 1 - Math.pow(1 - k, 3); // ease out, like the panel's slide
      return this.insetFrom + (this.insetTo - this.insetFrom) * e;
    }
    insetMoving(now = performance.now()) { return this.insetTo != null && now - this.insetT0 < 360; }

    // ------------------------------------------------------------ camera / input

    resize() {
      const r = this.root.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.cw = Math.max(this.compact ? 1 : 200, r.width);
      this.ch = Math.max(this.compact ? 1 : 240, r.height);
      this.canvas.width = Math.round(this.cw * dpr);
      this.canvas.height = Math.round(this.ch * dpr);
      this.canvas.style.width = this.cw + 'px';
      this.canvas.style.height = this.ch + 'px';
      this.dpr = dpr;
    }

    fitCamera() {
      const { W, D } = this.plan;
      const left = this.iso(0, D, 0).x, right = this.iso(W, 0, 0).x;
      const top = this.iso(0, 0, WALL_H).y - 20, bottom = this.iso(W, D, 0).y + 10;
      const inset = this.inset();
      const vw = Math.max(120, this.cw - inset);
      // Floating window: fill it edge to edge, and tell the app the room's shape.
      const pad = FLOATWIN ? 8 : 30;
      const zoom = Math.min(vw / (right - left + pad), this.ch / (bottom - top + pad), FLOATWIN ? 8 : 2);
      const aspect = (right - left + pad) / (bottom - top + pad);
      if (FLOATWIN && aspect !== this.sentAspect) {
        this.sentAspect = aspect;
        try { window.webkit.messageHandlers.aspect.postMessage(aspect); } catch { /* not in the app */ }
      }
      const want = { zoom, ox: vw / 2 - ((left + right) / 2) * zoom, oy: this.ch / 2 - ((top + bottom) / 2) * zoom };
      // While the inset eases, follow it exactly; otherwise settle gently.
      if (!this.cam || this.insetMoving()) this.cam = want;
      else for (const k of ['zoom', 'ox', 'oy']) this.cam[k] += (want[k] - this.cam[k]) * 0.1;
    }

    pointer(e, click) {
      const r = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let found = null;
      for (let i = this.hit.length - 1; i >= 0; i--) {
        const h = this.hit[i];
        if (mx >= h.x0 && mx <= h.x1 && my >= h.y0 && my <= h.y1) { found = h; break; }
      }
      const key = found ? found.key : null;
      this.canvas.style.cursor = key ? 'pointer' : 'default';
      if (key !== this.hoverKey || click) {
        this.hoverKey = key;
        const p = key && this.people.get(key);
        this.onHover(p ? p.s : null, { x: e.clientX, y: e.clientY }, !!click);
      }
    }

    iso(x, y, z = 0) {
      return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z * TH };
    }

    // ------------------------------------------------------------ primitives

    poly(pts, fill, stroke, lw = 1) {
      const c = this.ctx;
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      if (fill) { c.fillStyle = this.soft(fill); c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
    }

    // Cute palette: pull saturated hard-coded colours toward a warm cream.
    soft(color) {
      if (!this.pal.cute || typeof color !== 'string') return color;
      let r0, g0, b0;
      if (color[0] === '#' && color.length === 7) {
        const n = parseInt(color.slice(1), 16);
        r0 = n >> 16; g0 = (n >> 8) & 255; b0 = n & 255;
      } else {
        const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
        if (!m) return color;
        [r0, g0, b0] = [+m[1], +m[2], +m[3]];
      }
      const sat = Math.max(r0, g0, b0) - Math.min(r0, g0, b0), lum = (r0 + g0 + b0) / 3;
      // Dark and saturated colours get pulled further so nothing looks heavy.
      const k = lum < 90 ? 0.55 : sat > 90 ? 0.5 : 0.3;
      const m = (v, w) => Math.round(v + (w - v) * k);
      return `rgb(${m(r0, 255)},${m(g0, 248)},${m(b0, 238)})`;
    }

    box(x, y, z, w, d, h, top, left, right) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const ink = this.pal.cute && (w > 0.12 || d > 0.12) && h > 0.04 ? this.pal.ink : null;
      this.poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left, ink, 0.9);
      this.poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right, ink, 0.9);
      this.poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top, ink, 0.9);
    }

    shade(color, amt) {
      if (color[0] !== '#') return color;
      const n = parseInt(color.slice(1), 16);
      const f = (v) => clamp(Math.round(v + amt), 0, 255);
      return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
    }

    roundRect(x, y, w, h, r, fill, stroke) {
      const c = this.ctx;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
    }

    // Draw flat things on a wall: 'y0' = back wall (runs along x),
    // 'x0' = left wall (runs along y).
    onWall(dir, a, z, fn) {
      const c = this.ctx;
      const o = dir === 'y0' ? this.iso(a, 0, z) : this.iso(0, a, z);
      c.save();
      c.translate(o.x, o.y);
      c.transform(1, dir === 'y0' ? 0.5 : -0.5, 0, 1, 0, 0);
      fn(c);
      c.restore();
    }

    // ------------------------------------------------------------ room shell

    drawRoom() {
      if (BARE) return;
      const { W, D, OW, MR, PY, pp } = this.plan;
      const GX = this.plan.GX || OW;
      const pal = this.pal;
      const P = (x, y, z) => this.iso(x, y, z);
      const t = this.t / 1000;

      // floors: wood office, carpet meeting room, tiled pantry, wood lounge
      for (let x = 0; x < Math.ceil(OW); x++) {
        for (let y = 0; y < Math.ceil(D); y++) {
          const x1 = Math.min(OW, x + 1), y1 = Math.min(D, y + 1);
          this.poly([P(x, y), P(x1, y), P(x1, y1), P(x, y1)], (x + y) % 2 ? pal.wood1 : pal.wood2);
        }
      }
      for (let y = 0.5; y < D; y += 0.5) this.poly([P(0, y), P(OW, y), P(OW, y + 0.012), P(0, y + 0.012)], pal.woodLine);
      for (let x = OW; x < GX - 0.01; x++) {
        for (let y = 0; y < Math.ceil(MR); y++) {
          const x1 = Math.min(GX, x + 1), y1 = Math.min(MR, y + 1);
          this.poly([P(x, y), P(x1, y), P(x1, y1), P(x, y1)], (Math.floor(x) + y) % 2 ? pal.wood1 : pal.wood2);
        }
      }
      this.poly([P(GX, 0), P(W, 0), P(W, MR), P(GX, MR)], pal.carpet);
      for (let x = GX + 0.5; x < W; x += 0.5) this.poly([P(x, 0), P(x + 0.015, 0), P(x + 0.015, MR), P(x, MR)], pal.carpetLine);
      for (let i = 0; i < Math.ceil((W - OW) * 2); i++) {
        for (let j = 0; j < Math.ceil((PY - MR) * 2); j++) {
          const x = OW + i / 2, y = MR + j / 2;
          const x1 = Math.min(W, x + 0.5), y1 = Math.min(PY, y + 0.5);
          this.poly([P(x, y), P(x1, y), P(x1, y1), P(x, y1)], (i + j) % 2 ? pal.tileA : pal.tileB);
        }
      }
      for (let x = Math.floor(OW); x < W; x++) {
        for (let y = PY; y < D; y++) {
          const x0 = Math.max(OW, x), x1 = Math.min(W, x + 1), y1 = Math.min(D, y + 1);
          this.poly([P(x0, y), P(x1, y), P(x1, y1), P(x0, y1)], (x + Math.floor(y)) % 2 ? pal.wood1 : pal.wood2);
        }
      }
      this.poly([P(OW + 0.3, PY + 0.6), P(OW + 4.3, PY + 0.6), P(OW + 4.3, D - 0.4), P(OW + 0.3, D - 0.4)], pal.rug);
      this.poly([P(OW + 0.5, PY + 0.8), P(OW + 4.1, PY + 0.8), P(OW + 4.1, D - 0.6), P(OW + 0.5, D - 0.6)], null, pal.rugEdge);
      this.poly([P(pp.x0 - 0.6, pp.y - 1.4), P(pp.x1 + 0.6, pp.y - 1.4), P(pp.x1 + 0.6, pp.y + 1.3), P(pp.x0 - 0.6, pp.y + 1.3)], pal.mat);

      // walls
      const wInk = pal.cute ? pal.ink : null;
      this.poly([P(0, 0, 0), P(W, 0, 0), P(W, 0, WALL_H), P(0, 0, WALL_H)], pal.wallL, wInk, 1.4);
      this.poly([P(0, 0, 0), P(0, D, 0), P(0, D, WALL_H), P(0, 0, WALL_H)], pal.wallR, wInk, 1.4);
      if (pal.cute) {
        const c = this.ctx;
        const dot = (q, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(q.x, q.y, 2.2, 2.2, 0, 0, Math.PI * 2); c.fill(); };
        for (let x = 0.4, i = 0; x < W; x += 0.8, i++) for (let z = 0.45 + (i % 2) * 0.35; z < WALL_H - 0.2; z += 0.7) dot(P(x, 0, z), i % 3 ? '#fbd3dc' : '#cfe4f7');
        for (let y = 0.4, i = 0; y < D; y += 0.8, i++) for (let z = 0.45 + (i % 2) * 0.35; z < WALL_H - 0.2; z += 0.7) dot(P(0, y, z), i % 3 ? '#fff0c9' : '#d9f0dc');
        this.poly([P(0, 0), P(W, 0), P(W, D), P(0, D)], null, pal.ink, 1.4);
      }
      this.poly([P(0, 0, WALL_H), P(W, 0, WALL_H), P(W, -0.15, WALL_H), P(-0.15, -0.15, WALL_H), P(-0.15, D, WALL_H), P(0, D, WALL_H)], pal.wallTop);
      this.poly([P(0, 0, 0), P(W, 0, 0), P(W, 0, 0.12), P(0, 0, 0.12)], pal.trim);
      this.poly([P(0, 0, 0), P(0, D, 0), P(0, D, 0.12), P(0, 0, 0.12)], pal.trim);

      // windows with the real sky outside
      const sky = skyColor();
      for (const x of this.plan.windows) {
        this.poly([P(x, 0, 0.85), P(x + 1.5, 0, 0.85), P(x + 1.5, 0, 2.0), P(x, 0, 2.0)], sky.sky);
        if (sky.night) {
          this.onWall('y0', x + 0.3, 1.75, (c) => { c.fillStyle = '#f4f1d0'; c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill(); });
          this.onWall('y0', x + 1.1, 1.55, (c) => { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, 0, 1.5, 1.5); });
        } else {
          const cx = x + 0.25 + ((t * 0.02 + x * 0.37) % 1) * 1.0;
          this.onWall('y0', cx, 1.65, (c) => {
            c.fillStyle = 'rgba(255,255,255,.85)';
            c.beginPath(); c.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); c.ellipse(5, -2, 5, 3, 0, 0, Math.PI * 2); c.fill();
          });
        }
        this.poly([P(x + 0.74, 0, 0.85), P(x + 0.76, 0, 0.85), P(x + 0.76, 0, 2.0), P(x + 0.74, 0, 2.0)], pal.trim);
        this.poly([P(x, 0, 0.85), P(x + 1.5, 0, 0.85), P(x + 1.5, 0, 0.9), P(x, 0, 0.9)], pal.trim);
        this.poly([P(x, 0.05), P(x + 1.5, 0.05), P(x + 1.95, 1.2), P(x + 0.45, 1.2)], sky.night ? 'rgba(120,140,200,.06)' : 'rgba(255,250,230,.16)');
      }
      // meeting room whiteboard + sign
      const wx = GX + 0.5;
      this.poly([P(wx, 0, 0.8), P(wx + 2.6, 0, 0.8), P(wx + 2.6, 0, 1.95), P(wx, 0, 1.95)], '#fdfdfb', pal.trim);
      this.onWall('y0', wx + 0.25, 1.75, (c) => {
        c.lineWidth = 1.4;
        c.strokeStyle = '#3b8ee0';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(22, 0); c.moveTo(0, 7); c.lineTo(36, 7); c.stroke();
        c.strokeStyle = '#c96442';
        c.strokeRect(46, -2, 20, 12); c.strokeRect(80, 6, 20, 12);
        c.beginPath(); c.moveTo(66, 4); c.lineTo(80, 12); c.stroke();
        c.strokeStyle = '#5f9a4c';
        c.beginPath(); c.moveTo(0, 22); for (let i = 0; i < 8; i++) c.lineTo(i * 8, 22 - ((i * 37) % 13)); c.stroke();
      });
      this.onWall('y0', GX + 0.3, 2.2, (c) => {
        c.font = '700 9px ui-sans-serif, system-ui, sans-serif'; c.fillStyle = this.shade(pal.trim, -60); c.fillText('MEETING', 0, 0);
      });
      // left wall: posters, clock, door
      for (const ps of this.plan.posters) {
        this.poly([P(0, ps.y, 0.95), P(0, ps.y + 0.9, 0.95), P(0, ps.y + 0.9, 1.95), P(0, ps.y, 1.95)], ps.color);
        this.onWall('x0', ps.y + 0.45, 1.4, (c) => {
          c.font = '800 8px ui-sans-serif, system-ui, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(ps.text, 0, 0);
        });
      }
      this.onWall('x0', 1.0, 1.85, (c) => {
        c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fillStyle = pal.bubble; c.fill();
        c.lineWidth = 2; c.strokeStyle = pal.trim; c.stroke();
        const d = new Date();
        const hand = (ang, len, w) => { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ang) * len, -Math.cos(ang) * len); c.lineWidth = w; c.strokeStyle = pal.bubbleInk; c.stroke(); };
        hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, 5.5, 2);
        hand((d.getMinutes() / 60) * Math.PI * 2, 8, 1.4);
      });
      const dy = this.plan.door.y;
      this.poly([P(0, dy - 0.6, 0), P(0, dy + 0.6, 0), P(0, dy + 0.6, 1.8), P(0, dy - 0.6, 1.8)], pal.trim);
      this.poly([P(0, dy - 0.52, 0), P(0, dy + 0.52, 0), P(0, dy + 0.52, 1.72), P(0, dy - 0.52, 1.72)], this.shade(pal.deskL, -10));
      this.onWall('x0', dy - 0.25, 0.85, (c) => { c.fillStyle = '#d8c48a'; c.beginPath(); c.arc(0, 0, 1.8, 0, Math.PI * 2); c.fill(); });
      this.poly([P(0.05, dy - 0.6), P(0.9, dy - 0.6), P(0.9, dy + 0.6), P(0.05, dy + 0.6)], pal.dark ? '#5a3b2e' : '#b9654a');
    }

    // ------------------------------------------------------------ furniture

    plant(x, y) {
      const pal = this.pal;
      this.box(x - 0.18, y - 0.18, 0, 0.36, 0.36, 0.3, this.shade(pal.pot, 10), pal.pot, this.shade(pal.pot, -15));
      const c = this.ctx;
      const b = this.iso(x, y, 0.3);
      const sway = Math.sin(this.t / 1400 + x) * 0.05;
      c.fillStyle = pal.plant;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.beginPath();
        c.ellipse(b.x + Math.cos(a) * 6, b.y - 13 + Math.sin(a) * 3, 5.5, 13, a / 3 + sway, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = this.shade(pal.plant, 22);
      c.beginPath(); c.ellipse(b.x, b.y - 20, 5, 10, sway, 0, Math.PI * 2); c.fill();
    }

    serverRack(x, y) {
      this.box(x, y, 0, 0.7, 0.6, 1.9, '#3a3d44', '#24262b', '#1b1d21');
      const c = this.ctx;
      const busy = this.deskOf.size;
      for (let r = 0; r < 7; r++) {
        for (let k = 0; k < 4; k++) {
          const on = Math.sin(this.t / (180 + r * 37 + k * 53) + r * k) > 0.2 && (r * 4 + k) < Math.max(4, busy * 3);
          const p = this.iso(x + 0.12 + k * 0.13, y + 0.6, 1.7 - r * 0.22);
          c.fillStyle = on ? (k % 3 === 0 ? '#ffb347' : '#5cf08a') : '#2f3a33';
          c.fillRect(p.x - 1, p.y - 1, 2.5, 2);
        }
      }
    }

    printer(x, y) {
      const pal = this.pal;
      this.box(x, y, 0, 0.75, 0.55, 0.55, pal.deskTop, pal.deskL, pal.deskR);
      this.box(x + 0.05, y + 0.05, 0.55, 0.65, 0.45, 0.28, '#e8e8e8', '#c8c8c8', '#b3b3b3');
      this.box(x + 0.15, y + 0.35, 0.83, 0.45, 0.15, 0.02, '#ffffff', '#eee', '#ddd');
    }

    pingpong(x, y) {
      for (const [lx, ly] of [[0.1, 0.1], [2.4, 0.1], [0.1, 1.2], [2.4, 1.2]]) this.box(x + lx, y + ly, 0, 0.08, 0.08, 0.7, '#333', '#333', '#222');
      this.box(x, y, 0.7, 2.6, 1.4, 0.06, '#2f7a52', '#245f40', '#1d4f35');
      const P = (a, b, c) => this.iso(a, b, c);
      this.poly([P(x + 0.04, y + 0.69, 0.765), P(x + 2.56, y + 0.69, 0.765), P(x + 2.56, y + 0.71, 0.765), P(x + 0.04, y + 0.71, 0.765)], '#ffffff');
      this.poly([P(x + 1.3, y - 0.05, 0.76), P(x + 1.3, y + 1.45, 0.76), P(x + 1.3, y + 1.45, 0.95), P(x + 1.3, y - 0.05, 0.95)], 'rgba(255,255,255,.55)', '#ddd');
    }

    meetingTable(x, y) {
      const pal = this.pal;
      this.box(x + 0.3, y + 0.5, 0, 0.12, 0.4, 0.7, pal.deskL, pal.deskL, pal.deskR);
      this.box(x + 2.6, y + 0.5, 0, 0.12, 0.4, 0.7, pal.deskL, pal.deskL, pal.deskR);
      this.box(x, y, 0.7, 3.0, 1.4, 0.08, this.shade(pal.deskTop, 12), pal.deskL, pal.deskR);
      this.box(x + 1.2, y + 0.45, 0.78, 0.5, 0.35, 0.03, '#2a2a2e', '#222', '#1a1a1a');
      this.box(x + 0.4, y + 0.3, 0.78, 0.2, 0.28, 0.02, '#fff', '#eee', '#ddd');
      this.box(x + 2.2, y + 0.8, 0.78, 0.12, 0.12, 0.12, '#f2f2f2', '#d0d0d0', '#bbb');
    }

    stool(x, y, h, color) {
      this.box(x - 0.04, y - 0.04, 0, 0.08, 0.08, h, '#555', '#444', '#333');
      this.box(x - 0.2, y - 0.2, h, 0.4, 0.4, 0.07, this.shade(color, 18), color, this.shade(color, -18));
    }

    roundTable(x, y) {
      const c = this.ctx;
      this.box(x - 0.05, y - 0.05, 0, 0.1, 0.1, 0.72, '#555', '#444', '#333');
      const p = this.iso(x, y, 0.75);
      c.fillStyle = this.shade(this.pal.deskTop, -15);
      c.beginPath(); c.ellipse(p.x, p.y + 3, 30, 15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = this.shade(this.pal.deskTop, 15);
      c.beginPath(); c.ellipse(p.x, p.y, 30, 15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(p.x + 8, p.y - 2, 5, 2.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e6b35c';
      c.beginPath(); c.arc(p.x + 8, p.y - 3, 2, 0, Math.PI * 2); c.fill();
    }

    coffeeMachine(x, y) {
      this.box(x, y, 0.9, 0.5, 0.45, 0.6, '#555b63', '#3a3f45', '#2e3237');
      this.box(x + 0.15, y + 0.42, 1.0, 0.2, 0.05, 0.15, '#222', '#111', '#111');
      const p = this.iso(x + 0.4, y + 0.45, 1.35);
      this.ctx.fillStyle = Math.sin(this.t / 400) > 0 ? '#ff6b4a' : '#7a3a2a';
      this.ctx.fillRect(p.x, p.y, 2.5, 2.5);
      this.box(x + 0.6, y + 0.1, 0.9, 0.14, 0.14, 0.14, '#fff', '#ddd', '#ccc');
    }

    sink(x, y) {
      this.box(x, y + 0.05, 0.9, 0.55, 0.4, 0.02, '#9aa3ad', '#7d858e', '#6c737b');
      this.box(x + 0.22, y + 0.02, 0.92, 0.06, 0.06, 0.3, this.pal.metal, this.pal.metal, '#888');
      this.box(x + 0.22, y + 0.02, 1.2, 0.06, 0.2, 0.04, this.pal.metal, this.pal.metal, '#888');
    }

    fridge(x, y) {
      this.box(x, y, 0, 0.85, 0.75, 1.95, '#eef1f4', '#cfd5db', '#bcc3ca');
      const P = (a, b, c) => this.iso(a, b, c);
      this.poly([P(x, y + 0.75, 1.25), P(x + 0.85, y + 0.75, 1.25), P(x + 0.85, y + 0.75, 1.27), P(x, y + 0.75, 1.27)], '#9aa3ad');
      this.poly([P(x + 0.7, y + 0.75, 1.4), P(x + 0.73, y + 0.75, 1.4), P(x + 0.73, y + 0.75, 1.75), P(x + 0.7, y + 0.75, 1.75)], '#888');
      for (const [mx, mz, col] of [[0.2, 1.6, '#c96442'], [0.4, 1.45, '#3b8ee0'], [0.3, 0.9, '#5f9a4c']]) {
        const p = P(x + mx, y + 0.75, mz);
        this.ctx.fillStyle = col; this.ctx.fillRect(p.x, p.y, 4, 4);
      }
    }

    waterCooler(x, y) {
      this.box(x, y, 0, 0.42, 0.42, 0.95, '#e8ecef', '#cfd5db', '#bcc3ca');
      const c = this.ctx;
      const p = this.iso(x + 0.21, y + 0.21, 0.95);
      c.fillStyle = 'rgba(120,180,240,.6)';
      c.beginPath(); c.ellipse(p.x, p.y - 9, 8, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(p.x - 4, p.y - 16, 2, 10);
      const k = (this.t / 1800) % 1;
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(p.x + 2, p.y - 2 - k * 16, 1.2, 0, Math.PI * 2); c.fill();
      const tap = this.iso(x + 0.21, y + 0.42, 0.65);
      c.fillStyle = '#3b8ee0'; c.fillRect(tap.x - 1.5, tap.y, 3, 3);
    }

    couch(x, y) {
      const pal = this.pal;
      this.box(x, y - 0.05, 0.32, 2.8, 0.25, 0.42, this.shade(pal.couch, 10), pal.couchD, this.shade(pal.couchD, -12));
      this.box(x, y, 0, 2.8, 0.8, 0.32, pal.couch, pal.couchD, this.shade(pal.couchD, -12));
      this.box(x - 0.15, y - 0.05, 0, 0.18, 0.85, 0.52, this.shade(pal.couch, 6), pal.couchD, this.shade(pal.couchD, -12));
      this.box(x + 2.8, y - 0.05, 0, 0.18, 0.85, 0.52, this.shade(pal.couch, 6), pal.couchD, this.shade(pal.couchD, -12));
      this.box(x + 2.15, y + 0.12, 0.32, 0.35, 0.16, 0.28, '#e9c46a', '#d4ae52', '#c19c43');
    }

    coffeeTable(x, y) {
      const pal = this.pal;
      this.box(x, y, 0, 1.6, 0.7, 0.3, this.shade(pal.deskTop, -10), pal.deskL, pal.deskR);
      this.box(x + 0.2, y + 0.15, 0.3, 0.35, 0.25, 0.06, '#c96442', '#a85336', '#8f462e');
      this.box(x + 1.1, y + 0.3, 0.3, 0.12, 0.12, 0.12, '#fff', '#ddd', '#ccc');
    }

    beanbag(x, y, color) {
      const c = this.ctx;
      const p = this.iso(x, y, 0);
      c.fillStyle = this.shade(color, -25);
      c.beginPath(); c.ellipse(p.x, p.y - 4, 20, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.ellipse(p.x, p.y - 8, 18, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = this.shade(color, 20);
      c.beginPath(); c.ellipse(p.x - 3, p.y - 14, 10, 6, -0.2, 0, Math.PI * 2); c.fill();
    }

    books(x0, x1, y) {
      const P = (a, b, c) => this.iso(a, b, c);
      const cols = this.pal.book;
      for (let shelf = 0; shelf < 3; shelf++) {
        const z = 0.12 + shelf * 0.45;
        let bx = x0 + 0.05;
        let i = Math.round(x0 * 7) + shelf * 5;
        while (bx < x1 - 0.1) {
          const bw = 0.07 + ((i * 13) % 5) * 0.015;
          const bh = 0.25 + ((i * 7) % 4) * 0.03;
          if (i % 7 !== 3) this.poly([P(bx, y, z), P(bx + bw, y, z), P(bx + bw, y, z + bh), P(bx, y, z + bh)], cols[i % cols.length]);
          bx += bw + 0.015;
          i++;
        }
        this.poly([P(x0, y, z - 0.02), P(x1, y, z - 0.02), P(x1, y, z), P(x0, y, z)], this.pal.deskR);
      }
    }

    arcade(x, y) {
      this.box(x, y, 0, 0.7, 0.7, 1.75, '#3a2a6a', '#2b1f52', '#221843');
      const P = (a, b, c) => this.iso(a, b, c);
      const hue = (this.t / 20) % 360;
      this.poly([P(x + 0.1, y + 0.7, 1.0), P(x + 0.6, y + 0.7, 1.0), P(x + 0.6, y + 0.7, 1.45), P(x + 0.1, y + 0.7, 1.45)], `hsl(${hue},70%,55%)`);
      const blip = this.iso(x + 0.25 + 0.2 * Math.sin(this.t / 300), y + 0.7, 1.2);
      this.ctx.fillStyle = '#fff'; this.ctx.fillRect(blip.x, blip.y, 3, 3);
      this.poly([P(x, y + 0.7, 1.55), P(x + 0.7, y + 0.7, 1.55), P(x + 0.7, y + 0.7, 1.72), P(x, y + 0.7, 1.72)], '#ffcf4a');
      this.box(x, y + 0.7, 0.8, 0.7, 0.2, 0.08, '#4a3a8a', '#3a2a6a', '#2b1f52');
      const j = this.iso(x + 0.25, y + 0.8, 0.88);
      this.ctx.fillStyle = '#e04a4a'; this.ctx.beginPath(); this.ctx.arc(j.x, j.y - 3, 2.5, 0, Math.PI * 2); this.ctx.fill();
    }

    floorLamp(x, y) {
      const c = this.ctx;
      const b = this.iso(x, y, 0), t = this.iso(x, y, 1.7);
      if (skyColor().night) {
        c.fillStyle = 'rgba(255,220,140,.14)';
        c.beginPath(); c.ellipse(b.x, b.y, 50, 25, 0, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = '#333'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(t.x, t.y); c.stroke();
      c.fillStyle = '#333'; c.beginPath(); c.ellipse(b.x, b.y, 7, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f3e3b5';
      c.beginPath(); c.moveTo(t.x - 9, t.y + 4); c.lineTo(t.x + 9, t.y + 4); c.lineTo(t.x + 5, t.y - 8); c.lineTo(t.x - 5, t.y - 8); c.closePath(); c.fill();
    }

    vending(x, y, color) {
      this.box(x, y, 0, 0.7, 0.75, 1.85, this.shade(color, 15), this.shade(color, -10), color);
      const P = (a, b, c) => this.iso(a, b, c);
      const fx = x + 0.7;
      this.poly([P(fx, y + 0.08, 0.7), P(fx, y + 0.55, 0.7), P(fx, y + 0.55, 1.7), P(fx, y + 0.08, 1.7)], 'rgba(20,30,40,.75)');
      const cols = ['#f2d16b', '#5cf08a', '#ff8a65', '#81d4fa', '#ce93d8'];
      for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 3; k++) {
          const q = P(fx, y + 0.15 + k * 0.14, 1.55 - r * 0.23);
          this.ctx.fillStyle = cols[(r * 3 + k + Math.round(y)) % cols.length];
          this.ctx.fillRect(q.x - 1.5, q.y - 4, 3, 5);
        }
      }
      this.poly([P(fx, y + 0.1, 0.25), P(fx, y + 0.5, 0.25), P(fx, y + 0.5, 0.45), P(fx, y + 0.1, 0.45)], '#222');
      const glow = P(fx, y + 0.65, 1.2);
      this.ctx.fillStyle = Math.sin(this.t / 700 + y) > 0 ? '#9ef' : '#4ad';
      this.ctx.fillRect(glow.x - 1, glow.y - 3, 2, 6);
    }

    foosball(x, y) {
      for (const [lx, ly] of [[0.1, 0.1], [1.42, 0.1], [0.1, 0.62], [1.42, 0.62]]) this.box(x + lx, y + ly, 0, 0.08, 0.08, 0.6, '#5a4030', '#5a4030', '#4a3428');
      this.box(x, y, 0.6, 1.6, 0.8, 0.25, '#2f8a4a', '#6e533b', '#5c4431');
      const P = (a, b, c) => this.iso(a, b, c);
      const players = this.plan && this.plan.pois.filter((q) => q.pair === 'fb' && q.taken).length === 2;
      for (let k = 0; k < 6; k++) {
        const rx = x + 0.2 + k * 0.24;
        const shift = players ? Math.sin(this.t / 120 + k) * 0.06 : 0;
        const a = P(rx, y - 0.15, 0.82), b = P(rx, y + 0.95, 0.82);
        this.ctx.strokeStyle = '#c8ccd0'; this.ctx.lineWidth = 1.2;
        this.ctx.beginPath(); this.ctx.moveTo(a.x, a.y); this.ctx.lineTo(b.x, b.y); this.ctx.stroke();
        for (let m = 0; m < 2; m++) {
          const q = P(rx, y + 0.25 + m * 0.3 + shift, 0.82);
          this.ctx.fillStyle = k % 2 ? '#c0392b' : '#2f6fb0';
          this.ctx.fillRect(q.x - 1.5, q.y - 3, 3, 6);
        }
      }
    }

    booth(add, x, y) {
      const P = (a, b, c) => this.iso(a, b, c);
      const pal = this.pal;
      const H = 2.0;
      // back walls (felt panels), then the stool, then glass front
      add(x + 0.65 + y + 0.05, () => {
        this.poly([P(x, y, 0), P(x + 1.3, y, 0), P(x + 1.3, y, H), P(x, y, H)], pal.dark ? '#3c4a5a' : '#9fb3c8');
        this.poly([P(x, y, 0), P(x, y + 1.3, 0), P(x, y + 1.3, H), P(x, y, H)], pal.dark ? '#34404e' : '#8ea3b8');
        this.poly([P(x + 0.02, y + 0.02), P(x + 1.28, y + 0.02), P(x + 1.28, y + 1.28), P(x + 0.02, y + 1.28)], pal.dark ? '#2a323b' : '#d8dee5');
        const lamp = P(x + 0.65, y + 0.65, H - 0.05);
        this.ctx.fillStyle = 'rgba(255,230,160,.9)';
        this.ctx.beginPath(); this.ctx.ellipse(lamp.x, lamp.y, 8, 4, 0, 0, Math.PI * 2); this.ctx.fill();
        this.stool(x + 0.65, y + 0.6, 0.43, '#c96442');
      });
      add(x + 1.3 + y + 0.65 + 0.3, () => {
        this.poly([P(x + 1.3, y, 0), P(x + 1.3, y + 1.3, 0), P(x + 1.3, y + 1.3, H), P(x + 1.3, y, H)], pal.glass, pal.glassEdge);
        this.poly([P(x, y + 1.3, 0), P(x + 1.3, y + 1.3, 0), P(x + 1.3, y + 1.3, H), P(x, y + 1.3, H)], pal.glass, pal.glassEdge);
        this.poly([P(x + 0.85, y + 1.3, 0), P(x + 0.87, y + 1.3, 0), P(x + 0.87, y + 1.3, H), P(x + 0.85, y + 1.3, H)], pal.glassEdge);
        this.box(x - 0.03, y - 0.03, H, 1.36, 1.36, 0.08, pal.dark ? '#4a5868' : '#b5c4d3', pal.trim, pal.trim);
      });
    }

    desk(dk, p) {
      const pal = this.pal;
      const { x, y } = dk;
      for (const [lx, ly] of [[0.05, 0.05], [1.27, 0.05], [0.05, 0.67], [1.27, 0.67]]) {
        this.box(x + lx, y + ly, 0, 0.08, 0.08, 0.72, pal.deskL, pal.deskL, pal.deskR);
      }
      this.box(x, y, 0.72, 1.4, 0.8, 0.07, pal.deskTop, pal.deskL, pal.deskR);
      const worker = p && p.mode === 'work' ? p : null;
      if (dk.side === 's') {
        const mx = x + 0.42, my = y + 0.1, mz = 0.79;
        this.box(mx + 0.22, my + 0.04, mz, 0.1, 0.1, 0.18, pal.monitor, pal.monitor, pal.monitor);
        this.box(mx, my, mz + 0.18, 0.56, 0.08, 0.42, pal.monitor, pal.monitor, this.shade(pal.monitor, 10));
        this.screen(mx + 0.04, my + 0.08, mz + 0.22, 0.48, 0.34, worker);
        this.box(x + 0.48, y + 0.48, 0.79, 0.44, 0.16, 0.025, '#d8d8d8', '#aaa', '#999');
      } else {
        // We see this monitor from behind; a status LED on its back.
        const mx = x + 0.42, my = y + 0.6, mz = 0.79;
        this.box(x + 0.48, y + 0.16, 0.79, 0.44, 0.16, 0.025, '#d8d8d8', '#aaa', '#999');
        this.box(mx + 0.22, my - 0.02, mz, 0.1, 0.1, 0.18, pal.monitor, pal.monitor, pal.monitor);
        this.box(mx, my, mz + 0.18, 0.56, 0.08, 0.42, this.shade(pal.monitor, 15), this.shade(pal.monitor, 8), this.shade(pal.monitor, 12));
        if (worker) {
          const g = this.iso(mx + 0.28, my + 0.08, mz + 0.5);
          this.ctx.fillStyle = STATUS_COLOR[worker.s.status] || '#888';
          this.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t / 400 + worker.phase);
          this.ctx.beginPath(); this.ctx.arc(g.x, g.y, 1.8, 0, Math.PI * 2); this.ctx.fill();
          this.ctx.globalAlpha = 1;
        }
      }
      // personal touches, stable per desk
      const h = hash(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (h % 3 === 0) this.box(x + 1.12, y + 0.3, 0.79, 0.12, 0.12, 0.13, '#f2f2f2', '#d0d0d0', '#bbb');
      if (h % 5 === 1) {
        this.box(x + 0.14, y + 0.24, 0.79, 0.12, 0.12, 0.08, pal.pot, pal.pot, this.shade(pal.pot, -15));
        const q = this.iso(x + 0.2, y + 0.3, 0.87);
        this.ctx.fillStyle = pal.plant;
        this.ctx.beginPath(); this.ctx.ellipse(q.x, q.y - 4, 4, 6, 0, 0, Math.PI * 2); this.ctx.fill();
      }
      if (h % 4 === 2) this.box(x + 0.12, y + 0.45, 0.79, 0.22, 0.15, 0.05, '#f2d16b', '#d9b84f', '#c4a33f');
    }

    screen(x, y, z, w, h, p) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const st = p ? p.s.status : 'off';
      const base = { thinking: '#3a3160', tool: '#14324f', typing: '#123d2e', waiting: '#4d3510', error: '#4a1612' }[st] || this.pal.screenOff;
      const corners = [P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)];
      this.poly(corners, base);
      if (!p) return;
      const c = this.ctx;
      c.save();
      c.beginPath();
      corners.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.clip();
      const t = this.t / 1000;
      const col = STATUS_COLOR[st];
      if (st === 'tool' || st === 'typing') {
        const scroll = (t * (st === 'tool' ? 2.2 : 1.2) + p.phase) % 1;
        for (let i = -1; i < 6; i++) {
          const zz = z + h - 0.05 - ((i + scroll) * h) / 5;
          const len = 0.12 + ((p.h >> ((i + 8) & 15)) % 7) / 20;
          const a = P(x + 0.05, y, zz), b = P(x + 0.05 + Math.min(len, w - 0.1), y, zz);
          c.strokeStyle = i % 3 === 0 ? col : 'rgba(255,255,255,.55)';
          c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
      } else {
        const m = P(x + w / 2, y, z + h / 2);
        c.fillStyle = col;
        c.globalAlpha = st === 'thinking' ? 0.5 + 0.4 * Math.sin(t * 3 + p.phase) : 0.9;
        c.font = '700 10px ui-sans-serif, system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText({ thinking: '…', waiting: '?', error: '!' }[st] || '', m.x, m.y);
      }
      c.restore();
      c.save();
      c.globalAlpha = 0.18;
      const g = P(x + w / 2, y + 0.35, 0.8);
      c.fillStyle = col;
      c.beginPath(); c.ellipse(g.x, g.y, 18, 7, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    chair(dk, p) {
      const pal = this.pal;
      const sx = dk.seat.x - 0.25, sy = dk.seat.y - 0.22;
      const seated = p && !p.path.length && p.pose === 'sit' && Math.hypot(p.x - dk.seat.x, p.y - dk.seat.y) < 0.05;
      const ox = seated ? 0 : 0.12, oy = seated ? 0 : dk.side === 's' ? 0.18 : -0.18;
      this.box(sx + 0.22 + ox, sy + 0.19 + oy, 0, 0.06, 0.06, 0.32, '#222', '#222', '#111');
      if (dk.side === 'n') this.box(sx + ox, sy + oy - 0.05, 0.4, 0.5, 0.07, 0.55, this.shade(pal.chair, 15), pal.chair, this.shade(pal.chair, -10));
      this.box(sx + ox, sy + oy, 0.32, 0.5, 0.45, 0.08, this.shade(pal.chair, 15), pal.chair, this.shade(pal.chair, -10));
      if (dk.side === 's' && !seated) this.box(sx + ox, sy + oy + 0.4, 0.4, 0.5, 0.07, 0.5, this.shade(pal.chair, 15), pal.chair, this.shade(pal.chair, -10));
    }

    // ------------------------------------------------------------ people

    stateOf(p) {
      const s = p.s || {};
      if (p.path.length) return { pose: 'walk', face: p.walkFace, act: null, sitZ: 0 };
      if (p.mode === 'work' && p.desk) {
        const face = p.desk.side === 'n' ? 'front' : 'back';
        if (s.status === 'waiting' || s.status === 'error') return { pose: 'stand', face, act: 'wave', sitZ: 0 };
        if (p.desk.pose === 'stand') return { pose: 'stand', face, act: 'station', sitZ: 0 };
        return { pose: 'sit', face, act: p.shift || s.status === 'tool' || s.status === 'typing' ? 'type' : 'think', sitZ: 0.34 };
      }
      if (p.mode === 'wander' && p.poi) {
        const q = p.poi;
        return { pose: q.sit ? 'sit' : 'stand', face: q.face === 'side' ? 'front' : q.face, act: q.act, sitZ: q.sit || 0 };
      }
      return { pose: 'stand', face: 'front', act: null, sitZ: 0 };
    }

    person(p) {
      const c = this.ctx;
      const t = this.t / 1000;
      const s = p.s || {};
      const st = this.stateOf(p);
      p.pose = st.pose;
      const moving = st.pose === 'walk';
      const seated = st.pose === 'sit';
      const front = st.face !== 'back';
      const b = this.iso(p.x, p.y, st.sitZ);
      const step = moving ? Math.sin(t * 12 + p.phase) : 0;
      const bob = moving ? Math.abs(step) * 1.5 : 0;

      const fb = this.iso(p.x, p.y, 0);
      c.fillStyle = this.pal.shadow;
      c.beginPath(); c.ellipse(fb.x, fb.y, 10 * CHAR_BOOST, 5 * CHAR_BOOST, 0, 0, Math.PI * 2); c.fill();
      if (this.hoverKey === p.key) {
        c.strokeStyle = STATUS_COLOR[s.status] || '#888';
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(fb.x, fb.y, 14, 7, 0, 0, Math.PI * 2); c.stroke();
      }

      let x = b.x;
      const y = b.y - bob;
      if (st.act === 'pingpong') x += Math.sin(t * 7 + p.phase) * 4;
      if (st.act === 'foosball') x += Math.sin(t * 5 + p.phase) * 1.5;
      const sc = s.subagent ? 0.8 : 1;
      if (CHARS.length) return this.spritePerson(p, st, s, x, b.y, fb, sc, t, moving, seated, front);
      c.save();
      c.translate(x, y);
      c.scale(sc, sc);

      c.fillStyle = p.pants;
      if (seated) {
        c.fillRect(-5, -4, 4, 5);
        c.fillRect(1, -4, 4, 5);
      } else {
        c.fillRect(-5, -10, 4, 10 + step * 2);
        c.fillRect(1, -10, 4, 10 - step * 2);
        c.fillStyle = '#2a2a2a';
        c.fillRect(-5, -1 + step, 4, 2);
        c.fillRect(1, -1 - step, 4, 2);
      }
      const hip = seated ? -4 : -10;
      this.roundRect(-7, hip - 13, 14, 14, 3, p.shirt);
      const arm = this.shade(p.shirt, -18);
      const hand = (hx, hy) => { c.fillStyle = p.skin; c.beginPath(); c.arc(hx, hy, 2.2, 0, Math.PI * 2); c.fill(); };
      c.fillStyle = arm;
      const sip = Math.sin(t * 0.9 + p.phase) > 0.6;
      switch (st.act) {
        case 'wave': {
          const wave = Math.sin(t * 8 + p.phase) * 2;
          c.fillRect(6, hip - 26, 3, 14);
          hand(7.5 + wave * 0.5, hip - 27);
          c.fillStyle = arm; c.fillRect(-9, hip - 11, 3, 10);
          break;
        }
        case 'type': {
          const k1 = Math.sin(t * 18 + p.phase) > 0 ? 1 : 0;
          c.fillRect(-9, hip - 11 - k1, 3, 8);
          c.fillRect(6, hip - 11 - (1 - k1), 3, 8);
          break;
        }
        case 'coffee':
        case 'water': {
          c.fillRect(-9, hip - 11, 3, 10);
          c.fillRect(6, sip ? hip - 15 : hip - 11, 3, sip ? 7 : 10);
          const cupY = sip && front ? hip - 19 : hip - 4;
          c.fillStyle = st.act === 'water' ? 'rgba(170,215,255,.95)' : '#fafafa';
          c.fillRect(6, cupY, 5, 6);
          if (st.act === 'coffee') { c.fillStyle = '#6b3f22'; c.fillRect(7, cupY, 3, 1.5); }
          break;
        }
        case 'read': {
          c.fillRect(-8, hip - 11, 3, 7);
          c.fillRect(5, hip - 11, 3, 7);
          if (front) { c.fillStyle = pick(this.pal.book, p.h, 5); c.fillRect(-7, hip - 12, 14, 9); c.fillStyle = '#fff'; c.fillRect(-0.5, hip - 12, 1, 9); }
          break;
        }
        case 'whiteboard':
        case 'arcade': {
          const k = Math.sin(t * (st.act === 'arcade' ? 14 : 3) + p.phase);
          c.fillRect(-9, hip - 11, 3, 10);
          c.fillRect(6, hip - 20 + k * 2, 3, 12);
          hand(7.5, hip - 21 + k * 2);
          break;
        }
        case 'pingpong': {
          c.fillRect(-9, hip - 11, 3, 10);
          c.fillRect(6, hip - 14, 3, 9);
          c.fillStyle = '#c0392b';
          c.beginPath(); c.arc(10, hip - 16, 4, 0, Math.PI * 2); c.fill();
          break;
        }
        case 'foosball': {
          const k1 = Math.sin(t * 16 + p.phase) * 1.5;
          c.fillRect(-9, hip - 12 + k1, 3, 7);
          c.fillRect(6, hip - 12 - k1, 3, 7);
          break;
        }
        case 'phone': {
          c.fillRect(-9, hip - 11, 3, 10);
          c.fillRect(5, hip - 22, 3, 12);
          c.fillStyle = '#222'; c.fillRect(5, hip - 25, 3, 6);
          break;
        }
        case 'nap': {
          c.fillRect(-9, hip - 13, 3, 6);
          c.fillRect(6, hip - 13, 3, 6);
          break;
        }
        default: {
          const sw = moving ? step * 2 : 0;
          c.fillRect(-9, hip - 11 + sw, 3, 10);
          c.fillRect(6, hip - 11 - sw, 3, 10);
        }
      }

      const napping = st.act === 'nap';
      const hy = hip - 20 + (napping ? 7 : 0) + (st.act === 'think' ? Math.sin(t * 1.5 + p.phase) * 0.6 : 0);
      c.fillStyle = p.skin;
      c.beginPath(); c.arc(0, hy, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.hair;
      if (front && !napping) {
        c.beginPath(); c.arc(0, hy - 1.5, 7.3, Math.PI * 1.05, Math.PI * 1.95); c.fill();
        if (p.hairStyle === 1) { c.fillRect(-7.3, hy - 2, 2.5, 8); c.fillRect(4.8, hy - 2, 2.5, 8); }
        if (p.hairStyle === 2) { c.beginPath(); c.arc(0, hy - 8, 3.2, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#2a2018';
        const sleepy = s.status === 'idle';
        const blink = Math.sin(t * 0.7 + p.phase * 3) > 0.985;
        c.fillRect(-3, hy - 0.5, 1.6, blink || sleepy ? 0.7 : 2);
        c.fillRect(1.6, hy - 0.5, 1.6, blink || sleepy ? 0.7 : 2);
        c.strokeStyle = '#2a2018'; c.lineWidth = 1;
        if (p.mode === 'wander' && !sleepy) {
          c.beginPath(); c.arc(0, hy + 2.2, 2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
        } else if (s.status === 'error' && p.mode === 'work') {
          c.beginPath(); c.arc(0, hy + 4.5, 2, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke();
        }
      } else {
        c.beginPath(); c.arc(0, hy - 0.5, 7.2, 0, Math.PI * 2); c.fill();
        if (p.hairStyle === 2) { c.beginPath(); c.arc(0, hy - 7, 3.2, 0, Math.PI * 2); c.fill(); }
        if (p.hairStyle === 1) c.fillRect(-6, hy, 12, 8);
      }
      if (st.act === 'arcade' || st.act === 'beanbag') {
        c.strokeStyle = '#222'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, hy, 8, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      }
      c.restore();

      const headTop = y + (hy - 8) * sc;
      this.hit.push({ key: p.key, x0: x - 13, x1: x + 13, y0: headTop - 22, y1: fb.y + 4 });
      return { x, y: headTop, act: st.act };
    }

    spritePerson(p, st, s, x, baseY, fb, sc, t, moving, seated, front) {
      const c = this.ctx;
      if (p.charIdx == null) {
        // Prefer the hash's pick, but skip characters someone in the office already has.
        const used = new Set([...this.people.values()].map((q) => q.charIdx));
        let i = p.h % CHARS.length;
        for (let k = 0; k < CHARS.length && used.has(i); k++) i = (i + 1) % CHARS.length;
        p.charIdx = i;
      }
      const ch = CHARS[p.charIdx];
      let img, flip = false, dy = 0, tilt = 0, sq = 1;
      if (moving && front) {
        // 4 walk frames face left; mirror them when heading right on screen.
        img = ch.walk[Math.floor(t * 8 + p.phase) % 4];
        flip = p.walkSide === 'right';
        dy = -Math.abs(Math.sin(t * 12 + p.phase)) * 2;
      } else if (moving) {
        img = ch.back;
        dy = -Math.abs(Math.sin(t * 12 + p.phase)) * 2;
        tilt = Math.sin(t * 12 + p.phase) * 0.06;
      } else if (!front) {
        img = ch.back;
      } else {
        img = ch.front;
      }
      switch (st.act) {
        case 'type': dy -= Math.max(0, Math.sin(t * 18 + p.phase)) * 1.2; break;
        case 'think': tilt = Math.sin(t * 1.5 + p.phase) * 0.08; break;
        case 'wave': dy -= Math.abs(Math.sin(t * 6 + p.phase)) * 5; break;
        case 'nap': tilt = 0.35; sq = 0.92; break;
        case 'pet': {
          // Face the cat and give it gentle pats.
          const k = p.poi && p.poi.cat;
          if (k) img = (k.x - p.x) - (k.y - p.y) >= 0 ? ch.right : ch.left;
          dy -= Math.abs(Math.sin(t * 5 + p.phase)) * 1.5;
          tilt = Math.sin(t * 5 + p.phase) * 0.06;
          sq = 1 - Math.abs(Math.sin(t * 5 + p.phase)) * 0.03;
          break;
        }
        case 'pingpong': case 'foosball': case 'arcade':
          img = Math.sin(t * 3 + p.phase) > 0 ? ch.left : ch.right; dy -= Math.abs(Math.sin(t * 9 + p.phase)) * 2; break;
        case 'coffee': case 'water': case 'read': case 'phone': case 'whiteboard':
          tilt = Math.sin(t * 0.9 + p.phase) * 0.05; break;
        default:
          if (!moving && front && st.pose === 'stand') sq = 1 + Math.sin(t * 2 + p.phase) * 0.02; // breathing
      }
      sc *= CHAR_BOOST;
      const H = (img.dh || img.height / SPRITE_RES) * sc, W = (img.dw || img.width / SPRITE_RES) * sc;
      const footY = baseY + (seated ? 4 : 2);
      c.save();
      c.translate(x, footY + dy);
      c.rotate(tilt);
      c.scale(flip ? -1 : 1, sq);
      c.drawImage(img, -W / 2, -H, W, H);
      c.restore();
      if (s.status === 'error' && p.mode === 'work') {
        c.fillStyle = '#e04848'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
        c.fillText('!', x + W / 2, footY - H + 4);
      }
      const headTop = footY + dy - H + 6;
      if (!s.npc) this.hit.push({ key: p.key, x0: x - W / 2, x1: x + W / 2, y0: headTop - 22, y1: fb.y + 4 });
      return { x, y: headTop, act: st.act };
    }

    bubble(p, at) {
      if (p.s && p.s.npc) return; // extras have no session to label
      const c = this.ctx;
      const t = this.t / 1000;
      const s = p.s || {};
      const st = s.status;
      const pal = this.pal;
      const x = at.x, y = at.y - 6;
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const font = (w, px) => `${w} ${px}px ui-sans-serif, system-ui, -apple-system, "PingFang TC", "Apple Color Emoji", sans-serif`;
      c.font = font(600, 10);

      const badge = this.showAgent && AGENT_BADGES[s.agent];
      const pill = (text, fg, bg, yy, alpha = 1, identify = false) => {
        c.globalAlpha = alpha;
        let tx = text;
        while (c.measureText(tx).width > 118 && tx.length > 2) tx = tx.slice(0, -2) + '…';
        const extra = badge && identify ? 26 : 0;
        const w = c.measureText(tx).width + 12 + extra;
        const height = extra ? 22 : 16;
        this.roundRect(x - w / 2, yy - height / 2, w, height, 8, bg);
        c.fillStyle = fg;
        c.fillText(tx, x + extra / 2, yy + 0.5);
        if (extra) this.agentBadge(badge, x - w / 2 + 13, yy);
        c.globalAlpha = 1;
        return yy - 8;
      };

      let top = y;
      if (p.mode === 'work' && !p.path.length) {
        const col = STATUS_COLOR[st] || '#888';
        const ph = workPhase(s);
        if (ph && (st === 'thinking' || st === 'typing' || st === 'tool')) {
          // Phase label with animated dots, e.g. "💻 개발 중…"
          // Icon gets its own fixed slot (emoji measure unreliably), and the
          // width is set for "..." so the pill doesn't jitter as the dots move.
          const dots = '.'.repeat(1 + (Math.floor(t * 2.5) % 3));
          const yy = y - 12 - Math.abs(Math.sin(t * 2)) * 1.5;
          c.font = font(700, 10);
          const ICON = 14, tw = c.measureText(ph.text + '...').width;
          const w = 8 + ICON + 3 + tw + 8, h = 17, x0 = x - w / 2;
          this.roundRect(x0, yy - h / 2, w, h, 8.5, col);
          const ic = emojiIcon(ph.icon);
          if (ic) {
            const k = 12 / Math.max(ic.w, ic.h), iw = ic.w * k, ih = ic.h * k;
            c.drawImage(ic.cv, ic.x, ic.y, ic.w, ic.h, x0 + 8 + (ICON - iw) / 2, yy - ih / 2, iw, ih);
          }
          c.textAlign = 'left';
          c.font = font(700, 10);
          c.fillStyle = '#fff';
          c.fillText(ph.text + dots, x0 + 8 + ICON + 3, yy + 0.5);
          c.textAlign = 'center';
          c.font = font(600, 10);
          top = yy - 8;
        } else if (st === 'thinking') {
          c.fillStyle = pal.bubble;
          c.beginPath(); c.arc(x + 6, y - 2, 2, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(x + 10, y - 7, 3, 0, Math.PI * 2); c.fill();
          this.roundRect(x - 2, y - 26, 32, 16, 8, pal.bubble);
          for (let i = 0; i < 3; i++) {
            c.fillStyle = col;
            c.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(t * 5 - i * 0.7));
            c.beginPath(); c.arc(x + 6 + i * 8, y - 18, 2.4, 0, Math.PI * 2); c.fill();
          }
          c.globalAlpha = 1;
          top = y - 26;
        } else if (st === 'typing') {
          this.roundRect(x - 2, y - 24, 34, 16, 5, col);
          c.beginPath(); c.moveTo(x + 2, y - 9); c.lineTo(x - 2, y - 3); c.lineTo(x + 8, y - 9); c.fillStyle = col; c.fill();
          const n = Math.floor(t * 4) % 4;
          c.fillStyle = '#fff';
          for (let i = 0; i < n; i++) { c.beginPath(); c.arc(x + 7 + i * 8, y - 16, 2, 0, Math.PI * 2); c.fill(); }
          top = y - 24;
        } else if (st === 'tool') {
          const tool = (s.activity || 'tool').split(/[:\s]/)[0];
          top = pill('⚙ ' + tool, '#fff', col, y - 12);
        } else if (st === 'waiting' || st === 'error') {
          const jump = Math.abs(Math.sin(t * 4)) * 4;
          c.fillStyle = col;
          c.beginPath(); c.arc(x, y - 12 - jump, 9, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#fff';
          c.font = font(800, 12);
          c.fillText('!', x, y - 11.5 - jump);
          c.font = font(600, 10);
          top = y - 22 - jump;
        }
      } else if (p.mode === 'wander') {
        const justDone = st === 'done' && Date.now() - (s.lastEventAt || 0) < 3 * 60_000;
        const dozing = at.act === 'nap' || (st === 'idle' && (at.act === 'couch' || at.act === 'beanbag' || (p.poi && p.poi.sleepy)));
        if (justDone) {
          c.fillStyle = STATUS_COLOR.done;
          c.beginPath(); c.arc(x, y - 10, 7, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#fff'; c.font = font(800, 9); c.fillText('✓', x, y - 9.5); c.font = font(600, 10);
          top = y - 18;
        } else if (dozing && !p.path.length) {
          c.fillStyle = STATUS_COLOR.idle;
          c.font = font(700, 10);
          for (let i = 0; i < 3; i++) {
            const k = (t * 0.6 + i / 3) % 1;
            c.globalAlpha = 1 - k;
            c.fillText('z', x + 6 + k * 10, y - 4 - k * 18);
          }
          c.globalAlpha = 1;
          c.font = font(600, 10);
          top = y - 20;
        } else if (at.act && (ACT_EMOJI[at.act] || (p.poi && p.poi.emoji)) && !p.path.length) {
          const cycle = (t + p.phase * 3) % 9;
          if (cycle < 2.2) {
            c.globalAlpha = Math.min(1, cycle * 3, (2.2 - cycle) * 3);
            c.font = font(400, 13);
            c.fillText((p.poi && p.poi.emoji) || ACT_EMOJI[at.act], x, y - 10);
            c.globalAlpha = 1;
            c.font = font(600, 10);
            top = y - 18;
          }
        }
      }

      const hover = this.hoverKey === p.key;
      if (!s.subagent || hover) {
        pill(this.label(s), pal.text, pal.tagBg, top - 11, p.mode === 'work' || hover ? 1 : 0.7, true);
      } else if (badge) {
        this.agentBadge(badge, x, top - 11);
      }
      c.restore();
    }

    agentBadge(badge, x, y) {
      const c = this.ctx;
      c.save();
      c.globalAlpha = 1;
      if (badge.image.complete && badge.image.naturalWidth > 0) {
        if (badge.mono && this.pal.dark) c.filter = 'invert(1)';
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(badge.image, x - 9, y - 9, 18, 18);
      } else {
        c.fillStyle = this.pal.text;
        c.font = '800 10px ui-sans-serif, system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(badge.short, x, y + 0.5);
      }
      c.restore();
    }

    moveCat(dt, now, k = this.cat) {
      if (k.petBy && !this.people.has(k.petBy)) { k.petBy = null; k.until = now + rand(2000, 5000); }
      if (!k.path.length && now > k.until && !k.petBy) {
        const { W, D, grid } = this.plan;
        let tx, ty, tries = 0;
        do { tx = rand(0.6, W - 0.6); ty = rand(1, D - 0.6); tries++; } while (grid.blocked(tx, ty) && tries < 30);
        k.path = grid.path(k.x, k.y, tx, ty);
        k.until = Infinity;
      }
      if (k.path.length) {
        const n = k.path[0];
        const dx = n.x - k.x, dy = n.y - k.y, d = Math.hypot(dx, dy), v = 1.2 * dt;
        if (d > 0.001) k.face = dx - dy >= 0 ? 1 : -1;
        if (d <= v) { k.x = n.x; k.y = n.y; k.path.shift(); if (!k.path.length) k.until = now + rand(4000, 12000); }
        else { k.x += (dx / d) * v; k.y += (dy / d) * v; }
      }
    }

    drawCat(k = this.cat) {
      const c = this.ctx;
      const p = this.iso(k.x, k.y, 0);
      const t = this.t / 1000;
      const walking = k.path.length > 0;
      c.save();
      c.translate(p.x, p.y);
      const CS = FLOATWIN ? 1.5 : 1; // keep cats in proportion with the bigger floating-window characters
      c.scale(k.face * CS, CS);
      c.fillStyle = this.pal.shadow;
      c.beginPath(); c.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2); c.fill();
      const col = '#e09a4a';
      c.fillStyle = k.coat === 'calico' ? '#f3ece2' : col;
      if (walking) {
        const s = Math.sin(t * 14) * 1.5;
        c.fillRect(-5, -4, 2, 4 + s); c.fillRect(3, -4, 2, 4 - s);
      }
      const calico = k.coat === 'calico';
      const by = walking ? -6 : -4, hy = walking ? -10 : -9;
      // Being petted: the cat leans into it and its tail sways happily.
      const purr = k.petBy && !walking ? Math.sin(t * 6) * 0.6 : 0;
      const body = () => { c.beginPath(); c.ellipse(0, by + purr * 0.3, 7, walking ? 4 : 5, 0, 0, Math.PI * 2); };
      const head = () => { c.beginPath(); c.arc(6, hy + purr * 0.3, 3.6, 0, Math.PI * 2); };
      const ears = () => {
        c.beginPath(); c.moveTo(4, hy - 3); c.lineTo(5, hy - 7); c.lineTo(7, hy - 3.5); c.fill();
        c.beginPath(); c.moveTo(7, hy - 3.5); c.lineTo(9, hy - 6.5); c.lineTo(9.5, hy - 2); c.fill();
      };
      if (calico) {
        // White coat with ginger and black patches, outlined so it shows on light floors.
        const ink = '#6b4a3a';
        c.fillStyle = '#fffaf2';
        body(); c.fill(); c.strokeStyle = ink; c.lineWidth = 0.8; c.stroke();
        c.save(); body(); c.clip();
        c.fillStyle = '#e8963f'; c.beginPath(); c.ellipse(-3, by - 3, 4, 3.2, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3a302a'; c.beginPath(); c.ellipse(3, by - 3.5, 3, 2.4, -0.2, 0, Math.PI * 2); c.fill();
        c.restore();
        c.fillStyle = '#fffaf2'; head(); c.fill(); c.stroke();
        c.save(); head(); c.clip();
        c.fillStyle = '#3a302a'; c.beginPath(); c.arc(4, hy - 2, 2.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e8963f'; c.beginPath(); c.arc(8.5, hy - 2, 2.2, 0, Math.PI * 2); c.fill();
        c.restore();
        c.fillStyle = '#3a302a'; c.beginPath(); c.moveTo(4, hy - 3); c.lineTo(5, hy - 7); c.lineTo(7, hy - 3.5); c.fill();
        c.fillStyle = '#e8963f'; c.beginPath(); c.moveTo(7, hy - 3.5); c.lineTo(9, hy - 6.5); c.lineTo(9.5, hy - 2); c.fill();
        c.strokeStyle = '#e8963f';
      } else {
        body(); c.fill();
        head(); c.fill();
        ears();
        c.strokeStyle = col;
      }
      c.lineWidth = 2; c.lineCap = 'round';
      const sway = k.petBy ? Math.sin(t * 8) * 4 : Math.sin(t * 3) * 3;
      c.beginPath(); c.moveTo(-6, -6); c.quadraticCurveTo(-12, -8 + sway, -10, -14); c.stroke();
      c.fillStyle = '#2a2018';
      if (k.petBy && !walking) {
        // Happy closed eyes: ^
        c.lineWidth = 0.8; c.strokeStyle = '#2a2018';
        c.beginPath(); c.moveTo(6.5, hy - 0.6); c.lineTo(7.4, hy - 1.6); c.lineTo(8.3, hy - 0.6); c.stroke();
      } else {
        c.fillRect(7, hy - 1.5, 1.2, walking ? 1.2 : 0.6);
      }
      c.restore();
      // Hearts float up while someone pets it.
      const petter = k.petBy && this.people.get(k.petBy);
      if (petter && !petter.path.length && !walking) {
        c.save();
        c.textAlign = 'center';
        c.font = '9px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
        for (let i = 0; i < 2; i++) {
          const f = (t * 0.7 + i / 2) % 1;
          c.globalAlpha = 1 - f;
          c.fillText('💗', p.x + (i ? 4 : -3) + Math.sin(t * 3 + i) * 2, p.y - (FLOATWIN ? 24 : 16) - f * 14);
        }
        c.restore();
      }
    }

    pingPongBall() {
      const players = this.plan.pois
        .filter((q) => q.pair === 'pp' && q.taken)
        .map((q) => this.people.get(q.taken))
        .filter((p) => p && p.poi && p.poi.pair === 'pp' && !p.path.length);
      if (players.length < 2) return;
      const pp = this.plan.pp;
      const k = (this.t / 900) % 2;
      const f = k < 1 ? k : 2 - k;
      const x = pp.x0 + 0.3 + f * (pp.x1 - pp.x0 - 0.6);
      const z = 0.8 + Math.abs(Math.sin(f * Math.PI * 2)) * 0.45;
      const c = this.ctx;
      const sh = this.iso(x, pp.y, 0.77);
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath(); c.ellipse(sh.x, sh.y, 2.5, 1.2, 0, 0, Math.PI * 2); c.fill();
      const p = this.iso(x, pp.y, z);
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(p.x, p.y, 2.2, 0, Math.PI * 2); c.fill();
    }

    // ------------------------------------------------------------ frame

    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t = now;
      if (!this.visible) return;
      this.step(dt);
      if (this.draw() !== false) {
        if (!this.first && ++this.framesShown === 3) this.markReady(true);
        // Capture immediately: a WebGL drawing buffer may be cleared after
        // this task. The overlay and the 3D canvas must be copied together.
        if (this.onFrame) this.onFrame(this);
      }
    }

    // Advance people and the cat; shared by the 2D and 3D renderers.
    step(dt) {
      const wall = Date.now();
      this.npcShifts(wall);
      for (const [k, p] of this.people) {
        if (p.mode === 'wander') {
          if (p.poi && !p.path.length && p.until === Infinity) p.until = wall + p.stay;
          this.wander(p, wall);
        }
        if (p.path.length) {
          const n = p.path[0];
          const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy), v = SPEED * dt;
          if (d > 0.001) { p.walkFace = dx + dy >= 0 ? 'front' : 'back'; p.walkSide = dx - dy >= 0 ? 'right' : 'left'; }
          if (d <= v) { p.x = n.x; p.y = n.y; p.path.shift(); }
          else { p.x += (dx / d) * v; p.y += (dy / d) * v; }
        } else if (p.leaving) {
          this.people.delete(k);
        }
      }
      for (const k of this.cats) this.moveCat(dt, wall, k);
    }

    draw() {
      const c = this.ctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.clearRect(0, 0, this.cw, this.ch);
      this.fitCamera();
      c.translate(this.cam.ox, this.cam.oy);
      c.scale(this.cam.zoom, this.cam.zoom);

      this.drawRoom();
      const occupant = new Map();
      for (const p of this.people.values()) {
        if (p.mode === 'work' && p.desk) occupant.set(p.desk, p);
        else if (p.napDesk) occupant.set(p.napDesk, p);
      }
      const items = [...this.plan.items];
      for (const dk of this.plan.desks) {
        const p = occupant.get(dk);
        items.push({ depth: dk.x + 0.7 + dk.y + 0.4, draw: () => this.desk(dk, p) });
        items.push({ depth: dk.seat.x + dk.seat.y - 0.06, draw: () => this.chair(dk, p) });
      }
      for (const p of this.people.values()) items.push({ depth: p.x + p.y + 0.01, person: p });
      for (const k of this.cats) items.push({ depth: k.x + k.y, draw: () => this.drawCat(k) });
      items.sort((a, b) => a.depth - b.depth);

      this.hit = [];
      const heads = [];
      for (const it of items) {
        if (it.person) heads.push([it.person, this.person(it.person)]);
        else it.draw();
      }
      this.pingPongBall();
      if (this.compact || FLOATWIN) {
        // Keep labels readable when the room is scaled down (PiP, floating window).
        const u = FLOATWIN ? Math.max(1.15, Math.min(1.7, this.cw / 640)) : 1;
        c.save();
        c.setTransform(this.dpr * u, 0, 0, this.dpr * u, 0, 0);
        for (const [p, at] of heads) this.bubble(p, {
          ...at, x: (at.x * this.cam.zoom + this.cam.ox) / u, y: (at.y * this.cam.zoom + this.cam.oy) / u,
        });
        c.restore();
      } else {
        for (const [p, at] of heads) this.bubble(p, at);
      }

      if (this.offDuty > 0) {
        const d = this.iso(0.2, this.plan.door.y + 0.9, 0);
        c.font = '600 10px ui-sans-serif, system-ui, -apple-system, "PingFang TC", sans-serif';
        c.textAlign = 'center';
        c.fillStyle = this.pal.text;
        c.globalAlpha = 0.65;
        c.fillText(`+${this.offDuty} ${this.offDutyLabel}`, d.x - 10, d.y + 14);
        c.globalAlpha = 1;
      }

      const z = this.cam.zoom;
      this.hit = this.hit.map((h) => ({
        key: h.key,
        x0: h.x0 * z + this.cam.ox, x1: h.x1 * z + this.cam.ox,
        y0: h.y0 * z + this.cam.oy, y1: h.y1 * z + this.cam.oy,
      }));
    }
  }

  window.Office = Office;
  window.OFFICE_AGENT_BADGES = AGENT_BADGES;
  window.OfficeGrid = Grid;
})();
