// Isometric office: agents that are working sit at cubicle desks; a few that
// are off duty wander between the pantry, lounge, meeting room and ping-pong
// table. Plain canvas 2D with local provider logos, no dependencies.
(() => {
  'use strict';

  const TW = 64; // tile width px
  const TH = 32; // tile height px; one z unit is TH px too
  const WALL_H = 2.4;
  // Christmas decorations from November to early January; snow in the windows all winter.
  const NOW = new Date(), MON = NOW.getMonth();
  const XMAS = MON === 10 || MON === 11 || (MON === 0 && NOW.getDate() <= 10);
  const WINTER = MON >= 10 || MON <= 1;
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
    vending: '🥤', foosball: '⚽', phone: '📞', weed: '🌿', pond: '🐸', cake: '🍰', review: '🔍', claw: '🧸', board: '📋', pet: '💕', bake: '♨️', bungeo: '🐟', xmas: '🎄',
  };

  // What everyone is up to, shown as a little caption ("🎮 게임 중").
  // Each visit picks one line at random.
  const ACT_CAPTION = {
    coffee: [['☕', '커피 수혈 중'], ['☕', '라떼 마시는 중'], ['🫖', '차 우리는 중']],
    water: [['💧', '물 마시는 중'], ['💧', '수분 충전 중']],
    fridge: [['🍎', '간식 찾는 중'], ['🧃', '냉장고 터는 중'], ['🍰', '케이크 몰래 먹는 중']],
    sink: [['🫧', '컵 씻는 중'], ['🫧', '설거지 중']],
    stool: [['💬', '수다 떠는 중'], ['🍩', '도넛 먹는 중'], ['☁️', '멍 때리는 중']],
    couch: [['🛋️', '쉬는 중'], ['📺', '유튜브 보는 중'], ['☁️', '멍 때리는 중']],
    beanbag: [['🎧', '노래 듣는 중'], ['🎧', '노동요 고르는 중'], ['🌀', '뒹굴뒹굴']],
    window: WINTER ? [['❄️', '눈 구경 중'], ['⛰️', '경치 구경 중']] : [['⛰️', '경치 구경 중'], ['☁️', '구름 구경 중'], ['🌤️', '날씨 구경 중']],
    claw: [['🧸', '인형 뽑는 중'], ['🧸', '한 판만 더'], ['😤', '집게 탓하는 중']],
    review: [['🔍', '검토 중'], ['📝', '리뷰 쓰는 중'], ['✅', '결과 확인 중'], ['🖍️', '빨간펜 드는 중']],
    cake: [['🍰', '케이크 고르는 중'], ['🍓', '딸기 케이크 먹는 중'], ['🧁', '컵케이크 먹는 중']],
    weed: [['🌿', '풀 뽑는 중'], ['💰', '근로 중'], ['🌿', '제초 알바 중'], ['💦', '땀 흘리며 일하는 중']],
    pond: [['🐸', '개구리 구경 중'], ['🐟', '물고기 구경 중'], ['🪷', '연못 멍 중']],
    board: [['📋', '근로 공고 보는 중'], ['📋', '알바 찾는 중'], ['🤔', '어떤 일 할지 고민 중']],
    read: [['📖', '책 읽는 중'], ['📚', '만화책 보는 중'], ['📖', '공부하는 척']],
    whiteboard: [['✏️', '낙서하는 중'], ['💡', '아이디어 정리 중'], ['✏️', '그림 그리는 중']],
    meeting: [['💬', '회의 중'], ['🗣️', '토론 중'], ['😴', '회의 중 졸음']],
    arcade: [['🎮', '게임 중'], ['🕹️', '최고기록 도전 중'], ['🎮', '보스전 중']],
    pingpong: [['🏓', '탁구 치는 중'], ['🏓', '스매시 연습 중']],
    foosball: [['⚽', '축구 게임 중'], ['⚽', '내기 중']],
    plant: [['🌱', '화분 물 주는 중'], ['🌱', '식물이랑 대화 중']],
    vending: [['🥤', '음료 뽑는 중'], ['🍫', '과자 고르는 중']],
    phone: [['📞', '통화 중'], ['📞', '엄마랑 통화 중']],
    pet: [['💕', '고양이 쓰담 중'], ['🐱', '냥이랑 노는 중']],
    bake: [['♨️', '붕어빵 굽는 중'], ['🐟', '팥 채우는 중']],
    bungeo: [['🐟', '붕어빵 사는 중'], ['🐟', '붕어빵 먹는 중'], ['🤤', '붕어빵 기다리는 중']],
    xmas: [['🎄', '트리 구경 중'], ['🎁', '선물 흔들어보는 중'], ['⭐', '소원 비는 중']],
    nap: [['💤', '꾸벅꾸벅'], ['😪', '몰래 낮잠 중']],
    dance: [['🎵', '춤추는 중'], ['🎶', '신나는 중']],
    stretch: [['🙆', '스트레칭 중'], ['💪', '기지개 켜는 중']],
    scroll: [['📱', '딴짓 중'], ['📱', '폰 보는 중'], ['🛒', '쇼핑 중']],
    snack: [['🍪', '간식 먹는 중'], ['🍙', '삼각김밥 먹는 중'], ['🍫', '초콜릿 먹는 중']],
    hop: [['✨', '신나는 중'], ['🎉', '퇴근 생각 중']],
    shift: [['💻', '일하는 중'], ['📱', '딴짓 중'], ['🛒', '몰래 쇼핑 중'], ['🎧', '노동요 듣는 중'], ['😪', '졸면서 일하는 중'], ['🍪', '과자 먹으며 일하는 중']],
    grind: [['🔥', '열일 중'], ['💻', '일하는 중'], ['💪', '야근 중'], ['⌨️', '타닥타닥']],
  };
  // Free-floor things to do anywhere (no furniture needed).
  const FLOOR_ACTS = ['dance', 'stretch', 'scroll', 'snack', 'hop'];

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
  // Optional "workaholic" in chars.json: index of the character (counting rows
  // across all sheets, from 0) that takes the working sessions and works the most.
  let WORKAHOLIC = -1;
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
      // Where the head starts in the middle columns (for hats).
      try {
        const cx0 = Math.floor(out.width * 0.4), cw = Math.max(1, Math.floor(out.width * 0.2));
        const d = o.getImageData(cx0, 0, cw, out.height).data;
        out.topF = 0;
        find: for (let yy = 0; yy < out.height; yy++) for (let xx = 0; xx < cw; xx++) if (d[(yy * cw + xx) * 4 + 3] > 120) { out.topF = yy / out.height; break find; }
      } catch { out.topF = 0; }
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
      if (Number.isInteger(cfg.workaholic)) WORKAHOLIC = cfg.workaholic;
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
      dark: false, cute: true, ink: 'rgba(112,88,74,.6)',
      wood1: '#fbe3cf', wood2: '#f7d8c2', woodLine: 'rgba(160,110,80,.10)',
      tileA: '#fff7ec', tileB: '#fde3e6', carpet: '#d8ecf7', carpetLine: 'rgba(120,160,190,.10)',
      wallL: '#fff3e4', wallR: '#fde6df', wallTop: '#fffaf3', trim: '#e9c9b4',
      deskTop: '#e8d8c3', deskL: '#d8c4ab', deskR: '#c9b396',
      monitor: '#8c7a6e', screenOff: '#b9aca2', chair: '#e9b8aa',
      rug: '#b8c7b0', rugEdge: '#9fb397', couch: '#e9b8aa', couchD: '#d9a596',
      counter: '#fffdf8', counterL: '#f1e2d2', counterR: '#e7d3c1', metal: '#d8d4e4',
      glass: 'rgba(190,225,245,.22)', glassEdge: 'rgba(140,180,210,.55)', mat: '#cdeccf',
      text: '#5b4032', tagBg: 'rgba(255,252,246,.94)', bubble: '#fffdf8', bubbleInk: '#5b4032',
      plant: '#a9bda0', pot: '#e8d8c3', shadow: 'rgba(112,88,74,.16)', book: ['#e9b8aa', '#b8c7b0', '#d8bd98', '#d9cfe0', '#e7c66b'],
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
      if (this.pal.cute) return this.buildPaper(nWorking);
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
      const podRects = [];
      const pod = (px, py, panel) => {
        podRects.push({ x0: px - 0.45, y0: py - 1.05, x1: px + 3.2, y1: py + 2.7 });
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
        if (XMAS) add(px + 1.5 + py + 0.9, () => this.lightString(px - 0.08, py + 0.86, 3.1, 1.17));
      };
      for (let p = 0; p < pods; p++) {
        const c = p % podCols, r = Math.floor(p / podCols);
        pod(1.3 + c * 4.2, 2.0 + r * 4.7, PANEL[p % PANEL.length]);
      }
      // A smaller meeting room leaves room for one more pod next to it.
      const GX = OW + 3.6;                         // meeting room starts here
      pod(OW + 0.45, 2.0, PANEL[pods % PANEL.length]);
      const last = podRects[podRects.length - 1]; last.x1 = Math.min(last.x1, GX - 0.08);
      const VILLAGE = !!pal.cute;

      // ---- open office extras
      const rx = OW - 1.15;
      add(rx + 0.35 + 0.5, () => (VILLAGE ? this.roundTree(rx + 0.35, 0.5) : this.serverRack(rx, 0.2)));
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

      // ---- Christmas: the big tree right in the middle of the office
      let tree = null;
      if (XMAS) {
        // right of the ping-pong table, below the desks
        const cx = Math.min(OW - 1.8, Math.max(7.0, W / 2 - 0.6)), cy = Math.max(OD + 1.4, Math.min(D / 2, OD + 2.2));
        tree = { x: cx, y: cy };
        add(cx + cy + 0.3, () => this.xmasTree(cx, cy));
        solid(cx - 1.0, cy - 1.0, 2.0, 2.0, 0.05);
        poi(cx - 1.6, cy + 1.2, 'xmas', 'back', { w: 2 });
        poi(cx + 1.4, cy + 1.3, 'xmas', 'back', { w: 2 });
        poi(cx - 0.2, cy + 1.7, 'xmas', 'back', { w: 2 });
      }

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
        // Winter treat: a bungeoppang pojangmacha (street tent stall), down in the
        // front-left when there's room, and a Christmas tree where the stall was.
        const low = D - fy >= 4.2;
        const bx = low ? 4.6 : OW - 2.3, by = low ? D - 2.1 : fy + 0.15;
        this.pojangmacha(add, bx, by);
        solid(bx, by, 1.5, 0.75, 0.05);
        poi(bx + 0.75, by - 0.5, 'bake', 'front', { w: 3 });
        poi(bx + 0.35, by + 1.35, 'bungeo', 'back', { w: 5 });
        poi(bx + 1.15, by + 1.35, 'bungeo', 'back', { w: 5 });
        if (XMAS && low) {
          // two snowmen guarding the front corner
          add(OW - 1.2 + fy + 0.9, () => this.snowman(OW - 1.2, fy + 0.9, 'top'));
          add(6.6 + fy + 0.5, () => this.snowman(6.6, fy + 0.5, 'santa'));
          solid(OW - 1.45, fy + 0.65, 0.5, 0.5);
          solid(6.35, fy + 0.25, 0.5, 0.5);
        }
        if (!VILLAGE || !low) add(OW - 0.45 + D - 0.6, () => this.plant(OW - 0.45, D - 0.6)); // the pond sits there in the village
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

      // ---- village: job board, pond, weeding patch, mushrooms
      let pond = null, weeds = null, board = null;
      if (VILLAGE) {
        board = { x: 0.28, y: OD + 0.35, len: 1.1 };
        add(0.28 + OD + 0.9, () => this.jobBoard(board.x, board.y, board.len));
        solid(0.1, OD + 0.3, 0.4, 1.2);
        poi(1.05, OD + 0.9, 'board', 'back', { w: 1.6 });
        if (D - fy >= 4.2) {
          pond = { x: Math.min(OW - 2.0, 7.3), y: D - 1.45, rx: 1.1, ry: 0.72 };
          solid(pond.x - 1.05, pond.y - 0.68, 2.1, 1.36, 0.05);
          poi(pond.x - 0.3, pond.y - 1.05, 'pond', 'front', { w: 1.8 });
          poi(pond.x + 0.9, pond.y - 0.85, 'pond', 'front', { w: 1.8 });
          weeds = { x0: 1.5, y0: fy + 2.0, x1: 3.8, y1: fy + 3.0 };
          poi(2.0, fy + 2.5, 'weed', 'front', { w: 2.2 });
          poi(3.2, fy + 2.6, 'weed', 'front', { w: 2.2 });
          for (const [mx2, my2, col] of [[pond.x + 1.35, pond.y + 0.45, '#ef6b5b'], [pond.x - 1.3, pond.y + 0.55, '#f2a03d'], [1.1, fy + 3.3, '#ef6b5b']]) {
            add(mx2 + my2, () => this.mushroom(mx2, my2, col));
          }
        }
      }

      const posters = [
        { y: 2.2, color: '#c96442', text: 'SHIP IT' },
        { y: 4.6, color: '#10a37f', text: 'TESTS ✓' },
      ];
      return { W, D, OW, OD, MR, PY, RW, GX, pods, tree, podRects, pond, weeds, board, grid, items, props, pois, desks, windows, posters, pp, door: { x: 0.4, y: D - 1.2 } };
    }

    // The village (cute palette): desk islands of two scattered on the grass
    // between plants, a café in the back-right corner, a picnic table, a play
    // corner, a nap corner, and the bungeoppang cart by the gate.
    buildVillage(nWorking) {
      let islands = Math.max(6, Math.ceil((nWorking + 3) / 2));
      islands = Math.ceil(islands / 3) * 3;
      const rows = islands / 3;
      const Y0 = 1.6 + (rows - 1) * 3.8 + 2.9;     // where the work area ends
      const W = 19.5, D = Math.max(15.5, Y0 + 7.6);
      const grid = new Grid(W, D);
      const items = [], pois = [], desks = [], props = [], patches = [];
      const add = (depth, draw) => items.push({ depth, draw });
      const prop = (t, o) => props.push({ t, ...o });
      const solid = (x, y, w, d, pad) => grid.block(x, y, w, d, pad);
      const poi = (x, y, act, face, opt = {}) => pois.push({ x, y, act, face, sit: 0, ...opt });
      const TOY = ['#ffc8d8', '#bfe6d6', '#d8cdf6', '#ffe6a6', '#bcdcf6', '#ffd2b8'];

      // ---- desk islands: two desks face to face, a round rug underneath
      for (let i = 0; i < islands; i++) {
        const r = Math.floor(i / 3), k = i % 3;
        const x = 1.5 + k * 3.55 + (r % 2 ? 1.25 : 0), y = 1.6 + r * 3.8;
        const col = TOY[i % TOY.length];
        patches.push({ kind: 'oval', x: x + 0.7, y: y + 0.86, rx: 1.55, ry: 1.75, col: TOY[(i + 2) % TOY.length] });
        desks.push({ x, y, side: 'n', seat: { x: x + 0.7, y: y - 0.45 }, col });
        desks.push({ x, y: y + 0.92, side: 's', seat: { x: x + 0.7, y: y + 0.92 + 1.25 }, col });
        solid(x, y, 1.4, 1.72, 0.08);
        // a plant or a bush in the gap to the right
        if (k < 2) {
          const px = x + 1.4 + 1.08, py = y + 0.86 + (i % 2 ? 0.5 : -0.4);
          const bush = (i + r) % 2 === 0;
          add(px + py, () => (bush ? this.bush(px, py) : this.plant(px, py)));
          solid(px - 0.25, py - 0.25, 0.5, 0.5);
        }
      }
      const windows = [];
      for (let x = 1.0; x < 11.5; x += 2.4) { windows.push(x); poi(x + 0.75, 0.6, 'window', 'back'); }

      // ---- café (back right): counter along the fence, cake case, two tables
      const CX = 12.6;
      patches.push({ kind: 'deck', x0: CX - 0.4, y0: 0, x1: W, y1: 5.9, col: 'rgba(246,220,186,1)' });
      add(CX - 0.2 + 0.45, () => this.waterCooler(CX - 0.2, 0.2));
      solid(CX - 0.25, 0.15, 0.5, 0.5);
      poi(CX + 0.05, 1.15, 'water', 'back');
      const cw = W - 1.4 - (CX + 0.5);
      for (let k = 0; k < Math.ceil(cw / 0.9); k++) {
        const sx = CX + 0.5 + (cw / Math.ceil(cw / 0.9)) * k, sw = cw / Math.ceil(cw / 0.9);
        add(sx + sw / 2 + 0.35 - 0.5, () => this.toyCounter(sx, 0.2, sw, 0.7));
      }
      solid(CX + 0.5, 0.2, cw, 0.7);
      add(CX + 1.3 + 0.55, () => this.coffeeMachine(CX + 1.0, 0.32));
      add(CX + 2.8 + 0.55, () => this.cakeCase(CX + 2.4, 0.3));
      add(CX + 4.4 + 0.55, () => this.sink(CX + 4.1, 0.32));
      poi(CX + 1.25, 1.35, 'coffee', 'back');
      poi(CX + 2.8, 1.35, 'cake', 'back', { w: 1.6 });
      poi(CX + 4.35, 1.35, 'sink', 'back');
      add(W - 0.75 + 0.6, () => this.fridge(W - 1.15, 0.2));
      solid(W - 1.15, 0.2, 0.85, 0.75);
      poi(W - 0.75, 1.5, 'fridge', 'back');
      for (const [tx, ty] of [[CX + 1.3, 3.6], [CX + 4.6, 3.4]]) {
        add(tx + ty, () => this.roundTable(tx, ty));
        solid(tx - 0.45, ty - 0.45, 0.9, 0.9);
        for (const [sx, sy, face] of [[tx - 1.0, ty, 'front'], [tx + 1.0, ty, 'front'], [tx, ty + 1.0, 'back']]) {
          add(sx + sy - 0.02, () => this.mushroomStool(sx, sy, TOY[Math.floor(sx * 7) % TOY.length]));
          poi(sx, sy, 'stool', face, { sit: 0.4 });
        }
      }

      // ---- picnic table with a parasol: the meeting spot
      const mx = 13.0, my = 7.6;
      add(mx + 1.2 + my + 0.5, () => this.picnicTable(mx, my));
      solid(mx, my - 0.05, 2.6, 1.1);
      for (let k = 0; k < 3; k++) {
        const cx = mx + 0.45 + k * 0.85;
        poi(cx, my - 0.45, 'meeting', 'front', { sit: 0.4 });
        poi(cx, my + 1.45, 'meeting', 'back', { sit: 0.4 });
      }

      // ---- nap corner + lounge (front right)
      const LY = Math.max(10.2, D - 5.2);
      patches.push({ kind: 'deck', x0: 12.2, y0: LY - 0.3, x1: W, y1: D, col: 'rgba(250,226,200,1)' });
      patches.push({ kind: 'rug', x0: 12.7, y0: LY + 0.5, x1: 16.3, y1: D - 0.5, col: 'rgba(214,236,250,1)' });
      add(12.9 + LY + 0.6, () => this.couch(12.9, LY + 0.6));
      solid(12.9, LY + 0.6, 2.8, 0.8);
      for (let k = 0; k < 3; k++) poi(13.4 + k * 0.9, LY + 1.2, 'couch', 'front', { sit: 0.36 });
      add(14.3 + LY + 2.3, () => this.coffeeTable(13.5, LY + 2.0));
      solid(13.5, LY + 2.0, 1.6, 0.7);
      for (const [bx, by, col] of [[13.2, D - 1.2, '#ffb7c9'], [15.6, D - 1.1, '#b9d4f4']]) {
        add(bx + by, () => this.beanbag(bx, by, col));
        poi(bx, by, 'beanbag', 'front', { sit: 0.18 });
      }
      // futons for napping
      for (const [fx, fy, col] of [[17.0, LY + 1.0, '#ffd9e4'], [17.0, LY + 2.8, '#d9eefc']]) {
        add(fx + fy + 0.3, () => this.futon(fx, fy, col));
        poi(fx + 0.6, fy + 0.45, 'nap', 'front', { sit: 0.12, sleepy: true, futon: true });
      }
      // bookshelf on the lounge's back edge
      const shX = 16.2;
      for (let k = 0; k < 3; k++) {
        const sx = shX + k * 0.95;
        add(sx + 0.47 + LY - 0.6 + 0.2, () => { this.box(sx, LY - 0.75, 0, 0.95, 0.4, 1.35, '#ffe2c6', '#f4c9a4', '#e9b98f'); this.books(sx, sx + 0.95, LY - 0.35); });
      }
      solid(shX, LY - 0.75, 2.85, 0.4);
      poi(shX + 0.6, LY + 0.1, 'read', 'back');
      poi(shX + 2.0, LY + 0.1, 'read', 'back');
      const ax = W - 1.0, ay = D - 1.6;
      add(ax + 0.35 + ay + 0.35, () => this.arcade(ax, ay - 0.35));
      solid(ax, ay - 0.35, 0.7, 0.7);
      poi(ax + 0.35, ay + 0.8, 'arcade', 'back');

      // ---- plaza with the tree (big Christmas tree in season)
      const tx = 8.4, ty = Y0 + 2.0;
      let tree = null;
      if (XMAS) {
        tree = { x: tx, y: ty };
        add(tx + ty + 0.3, () => this.xmasTree(tx, ty));
        poi(tx - 1.6, ty + 1.2, 'xmas', 'back', { w: 2 });
        poi(tx + 1.4, ty + 1.3, 'xmas', 'back', { w: 2 });
        poi(tx - 0.2, ty + 1.7, 'xmas', 'back', { w: 2 });
        add(10.4 + Y0 + 1.0, () => this.snowman(10.4, Y0 + 1.0, 'top'));
        add(6.3 + Y0 + 3.6, () => this.snowman(6.3, Y0 + 3.6, 'santa'));
        solid(10.15, Y0 + 0.75, 0.5, 0.5);
        solid(6.05, Y0 + 3.35, 0.5, 0.5);
      } else {
        add(tx + ty, () => this.roundTree(tx, ty));
      }
      solid(tx - 1.0, ty - 1.0, 2.0, 2.0, 0.05);

      // ---- play corner (left): vending, ping-pong, foosball, job board
      patches.push({ kind: 'mat', x0: 1.6, y0: Y0 + 0.1, x1: 5.6, y1: Y0 + 2.9, col: 'rgba(200,232,214,1)' });
      add(0.5 + Y0 + 0.9, () => this.vending(0.12, Y0 + 0.5, '#ff9fb2'));
      add(0.5 + Y0 + 1.7, () => this.vending(0.12, Y0 + 1.3, '#9fc4f2'));
      solid(0.1, Y0 + 0.5, 0.75, 1.55);
      poi(1.25, Y0 + 0.9, 'vending', 'back');
      poi(1.25, Y0 + 1.7, 'vending', 'back');
      const px = 2.3, py = Y0 + 0.8;
      add(px + 1.3 + py + 0.7, () => this.pingpong(px, py));
      solid(px, py, 2.6, 1.4, 0.05);
      poi(px - 0.5, py + 0.7, 'pingpong', 'side', { pair: 'pp' });
      poi(px + 3.1, py + 0.7, 'pingpong', 'side', { pair: 'pp' });
      const pp = { x0: px - 0.2, x1: px + 2.8, y: py + 0.7 };
      const fx = 2.6, fby = Y0 + 3.7;
      add(fx + 0.8 + fby + 0.4, () => this.foosball(fx, fby));
      solid(fx, fby, 1.6, 0.8, 0.05);
      poi(fx - 0.45, fby + 0.4, 'foosball', 'side', { pair: 'fb' });
      poi(fx + 2.05, fby + 0.4, 'foosball', 'side', { pair: 'fb' });
      const board = { x: 0.28, y: Y0 + 2.6, len: 1.1 };
      add(0.28 + Y0 + 3.15, () => this.jobBoard(board.x, board.y, board.len));
      solid(0.1, Y0 + 2.55, 0.4, 1.2);
      poi(1.05, Y0 + 3.15, 'board', 'back', { w: 1.6 });

      // ---- front: bungeoppang cart by the gate, weeding patch, pond
      const door = { x: 0.4, y: D - 1.2 };
      const bx = 2.4, by = D - 2.25;
      this.pojangmacha(add, bx, by);
      solid(bx, by, 1.5, 0.75, 0.05);
      poi(bx + 0.75, by - 0.5, 'bake', 'front', { w: 3 });
      poi(bx + 0.35, by + 1.35, 'bungeo', 'back', { w: 5 });
      poi(bx + 1.15, by + 1.35, 'bungeo', 'back', { w: 5 });
      const weeds = { x0: 5.4, y0: D - 2.7, x1: 7.6, y1: D - 1.5 };
      poi(5.9, D - 2.1, 'weed', 'front', { w: 2.2 });
      poi(7.0, D - 2.0, 'weed', 'front', { w: 2.2 });
      const pond = { x: 9.9, y: D - 1.7, rx: 1.15, ry: 0.75 };
      solid(pond.x - 1.1, pond.y - 0.7, 2.2, 1.4, 0.05);
      poi(pond.x - 0.4, pond.y - 1.1, 'pond', 'front', { w: 1.8 });
      poi(pond.x + 0.9, pond.y - 0.9, 'pond', 'front', { w: 1.8 });
      for (const [mx2, my2, col] of [[pond.x + 1.45, pond.y + 0.4, '#ef6b5b'], [pond.x - 1.4, pond.y + 0.6, '#f2a03d'], [5.1, D - 0.9, '#ef6b5b'], [11.6, Y0 + 0.4, '#b48cff']]) add(mx2 + my2, () => this.mushroom(mx2, my2, col));
      for (const [bx2, by2] of [[11.6, 6.4], [0.6, 0.6], [11.4, Y0 + 3.4], [W - 0.6, 6.6]]) { add(bx2 + by2, () => this.bush(bx2, by2)); solid(bx2 - 0.3, by2 - 0.3, 0.6, 0.6); }
      const path = [[0.6, door.y], [2.0, door.y + 0.35], [4.6, D - 0.75], [8.0, D - 0.6], [8.6, Y0 + 3.2], [11.6, Y0 + 2.4], [12.4, LY + 0.2]];

      return {
        W, D, OW: 12.2, OD: Y0, MR: 5.9, PY: LY, RW: W - 12.2, GX: W, pods: islands === 6 ? 2 : islands / 2,
        tree, patches, pond, weeds, board, path, village: true,
        grid, items, props, pois, desks, windows, posters: [], pp, door,
      };
    }

    // ---- pastel toy furniture

    // A short cylinder (stool seats, table legs) from (x, y) at height z.
    cyl(x, y, z, r, h, top, side) {
      const c = this.ctx, b = this.iso(x, y, z), t = this.iso(x, y, z + h);
      const rx = r * TW * 0.72, ry = rx / 2, ink = this.pal.ink;
      c.fillStyle = this.soft(side); c.strokeStyle = ink; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(b.x - rx, b.y); c.ellipse(b.x, b.y, rx, ry, 0, Math.PI, 0, true); c.lineTo(t.x + rx, t.y); c.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI, true); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = this.soft(top); c.beginPath(); c.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    toyDesk(dk, p) {
      const { x, y } = dk, col = dk.col || '#ffc8d8', pal = this.pal;
      const leg = this.shade(col, -30);
      for (const [lx, ly] of [[0.12, 0.12], [1.28, 0.12], [0.12, 0.68], [1.28, 0.68]]) this.cyl(x + lx, y + ly, 0, 0.06, 0.68, leg, leg);
      this.box(x, y, 0.68, 1.4, 0.8, 0.1, '#fffaf2', this.shade(col, -8), this.shade(col, -18));
      this.box(x + 0.04, y + 0.04, 0.78, 1.32, 0.72, 0.012, col, col, col);
      const worker = p && p.mode === 'work' ? p : null;
      const frame = '#fffdf8', back = this.shade(col, -10);
      if (dk.side === 's') {
        const mx = x + 0.42, my = y + 0.1, mz = 0.79;
        this.cyl(mx + 0.28, my + 0.08, mz, 0.05, 0.16, back, back);
        this.box(mx, my, mz + 0.16, 0.56, 0.08, 0.44, frame, frame, '#f1e6da');
        this.screen(mx + 0.05, my + 0.08, mz + 0.21, 0.46, 0.34, worker);
        this.box(x + 0.48, y + 0.48, 0.79, 0.44, 0.16, 0.025, '#fffdf8', '#efe3d6', '#e6d8c9');
      } else {
        const mx = x + 0.42, my = y + 0.6, mz = 0.79;
        this.box(x + 0.48, y + 0.16, 0.79, 0.44, 0.16, 0.025, '#fffdf8', '#efe3d6', '#e6d8c9');
        this.cyl(mx + 0.28, my + 0.02, mz, 0.05, 0.16, back, back);
        this.box(mx, my, mz + 0.16, 0.56, 0.08, 0.44, back, back, this.shade(back, 6));
        // a little heart sticker on the back, and the status light
        const g = this.iso(mx + 0.28, my + 0.08, mz + 0.4);
        const c = this.ctx;
        c.fillStyle = '#e38f80'; c.beginPath(); c.arc(g.x - 1.6, g.y - 1, 1.7, 0, Math.PI * 2); c.arc(g.x + 1.6, g.y - 1, 1.7, 0, Math.PI * 2); c.moveTo(g.x - 3.2, g.y - 0.5); c.lineTo(g.x, g.y + 3); c.lineTo(g.x + 3.2, g.y - 0.5); c.fill();
        if (worker) {
          const s = this.iso(mx + 0.28, my + 0.08, mz + 0.55);
          c.fillStyle = STATUS_COLOR[worker.s.status] || '#888';
          c.globalAlpha = 0.6 + 0.4 * Math.sin(this.t / 400 + worker.phase);
          c.beginPath(); c.arc(s.x, s.y, 1.8, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 1;
        }
      }
      // toys on the desk, stable per desk: mushroom lamp, mug, plant, snack
      const h = hash(`${x.toFixed(1)},${y.toFixed(1)}`);
      const zt = 0.79;
      if (h % 3 === 0) {
        const lx = x + 1.15, ly = y + 0.32;
        this.cyl(lx, ly, zt, 0.025, 0.2, '#fff1d6', '#fff1d6');
        const q = this.iso(lx, ly, zt + 0.2), c = this.ctx;
        c.fillStyle = 'rgba(255,236,160,.35)'; c.beginPath(); c.arc(q.x, q.y + 2, 9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e9b8aa'; c.strokeStyle = pal.ink; c.lineWidth = 0.8; c.beginPath(); c.ellipse(q.x, q.y, 6, 4.5, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(q.x - 2, q.y - 2, 1, 0, Math.PI * 2); c.arc(q.x + 2, q.y - 3, 0.9, 0, Math.PI * 2); c.fill();
      } else if (h % 3 === 1) {
        this.cyl(x + 1.16, y + 0.35, zt, 0.06, 0.12, '#7a4e33', '#fffdf8');
      }
      if (h % 5 === 1) {
        this.cyl(x + 0.2, y + 0.3, zt, 0.06, 0.09, this.shade(col, -25), this.shade(col, -25));
        const q = this.iso(x + 0.2, y + 0.3, zt + 0.09), c = this.ctx;
        c.fillStyle = '#9cbc95'; c.beginPath(); c.ellipse(q.x - 2, q.y - 4, 2.5, 5, -0.4, 0, Math.PI * 2); c.ellipse(q.x + 2, q.y - 4, 2.5, 5, 0.4, 0, Math.PI * 2); c.fill();
      }
      if (h % 4 === 2) this.box(x + 0.12, y + 0.45, zt, 0.22, 0.15, 0.05, '#f3e3b0', '#e7d39c', '#dbc68a');
    }

    toyChair(dk, p) {
      const seated = p && !p.path.length && p.pose === 'sit' && Math.hypot(p.x - dk.seat.x, p.y - dk.seat.y) < 0.05;
      const ox = seated ? 0 : 0.1, oy = seated ? 0 : dk.side === 's' ? 0.16 : -0.16;
      const col = this.shade(dk.col || '#ffc8d8', -6);
      this.cyl(dk.seat.x + ox, dk.seat.y + oy, 0, 0.07, 0.28, '#fffaf2', '#fffaf2');
      this.cyl(dk.seat.x + ox, dk.seat.y + oy, 0.26, 0.26, 0.08, col, this.shade(col, -14));
    }

    mushroomStool(x, y, col) {
      this.cyl(x, y, 0, 0.12, 0.3, '#fff6e8', '#fff6e8');
      this.cyl(x, y, 0.28, 0.27, 0.1, col, this.shade(col, -16));
      const q = this.iso(x, y, 0.38), c = this.ctx;
      c.fillStyle = '#ffffff'; for (const [ox, oy, r] of [[-6, 0, 1.6], [4, -2, 1.9], [2, 3, 1.2]]) { c.beginPath(); c.arc(q.x + ox, q.y + oy, r, 0, Math.PI * 2); c.fill(); }
    }

    toyCounter(x, y, w, d) {
      this.box(x, y, 0, w, d, 0.82, '#d9f2e6', '#bfe6d6', '#a9d9c4');
      this.box(x - 0.02, y - 0.02, 0.82, w + 0.04, d + 0.04, 0.08, '#fffaf2', '#f1e3d3', '#e7d6c3');
      const c = this.ctx, q = this.iso(x + w / 2, y + d, 0.42);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(q.x, q.y, 2.2, 0, Math.PI * 2); c.fill();
    }

    cakeCase(x, y) {
      this.box(x, y, 0.9, 0.85, 0.5, 0.06, '#ffd2df', '#f7b9cb', '#eea7bb');
      const P = (a, b, cc) => this.iso(a, b, cc);
      this.poly([P(x, y + 0.5, 0.96), P(x + 0.85, y + 0.5, 0.96), P(x + 0.85, y + 0.5, 1.36), P(x, y + 0.5, 1.36)], 'rgba(220,240,255,.35)', 'rgba(140,180,210,.7)');
      const c = this.ctx;
      [['#fff3f6', '#ff8fae'], ['#fff7dc', '#ffcf5a'], ['#f3eaff', '#b48cff']].forEach(([cream, top], i) => {
        const q = this.iso(x + 0.18 + i * 0.25, y + 0.3, 0.98);
        c.fillStyle = cream; c.fillRect(q.x - 4, q.y - 6, 8, 6);
        c.fillStyle = top; c.beginPath(); c.ellipse(q.x, q.y - 6, 4, 2, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e8413a'; c.beginPath(); c.arc(q.x, q.y - 8, 1.4, 0, Math.PI * 2); c.fill();
      });
      this.poly([P(x, y, 1.36), P(x + 0.85, y, 1.36), P(x + 0.85, y + 0.5, 1.36), P(x, y + 0.5, 1.36)], 'rgba(220,240,255,.3)', 'rgba(140,180,210,.7)');
    }

    picnicTable(x, y) {
      const wood = '#ffd9b0', woodL = '#f3c08e', woodR = '#e6ad78';
      for (const by of [y - 0.45, y + 1.15]) {
        for (const lx of [0.15, 2.35]) this.box(x + lx, by + 0.05, 0, 0.08, 0.08, 0.36, woodL, woodL, woodR);
        this.box(x, by, 0.36, 2.6, 0.3, 0.06, '#ffe8cf', woodL, woodR);
      }
      for (const lx of [0.2, 2.3]) this.box(x + lx, y + 0.45, 0, 0.1, 0.1, 0.72, woodL, woodL, woodR);
      this.box(x, y, 0.72, 2.6, 1.0, 0.07, wood, woodL, woodR);
      // red-check cloth stripe
      const P = (a, b, cc) => this.iso(a, b, cc);
      for (let k = 0; k < 5; k++) this.poly([P(x + 0.9 + (k % 2) * 0.16, y + k * 0.2, 0.795), P(x + 1.06 + (k % 2) * 0.16, y + k * 0.2, 0.795), P(x + 1.06 + (k % 2) * 0.16, y + k * 0.2 + 0.2, 0.795), P(x + 0.9 + (k % 2) * 0.16, y + k * 0.2 + 0.2, 0.795)], 'rgba(255,140,150,.7)');
      // parasol
      const cx = x + 1.3, cy = y + 0.5;
      this.cyl(cx, cy, 0.79, 0.025, 1.3, '#fffdf8', '#fffdf8');
      const top = this.iso(cx, cy, 2.25), c = this.ctx, R = 58;
      const cols = ['#ffb3c6', '#fffaf2'];
      for (let k = 0; k < 8; k++) {
        const a0 = Math.PI + (k / 8) * Math.PI, a1 = Math.PI + ((k + 1) / 8) * Math.PI;
        c.fillStyle = cols[k % 2]; c.strokeStyle = this.pal.ink; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(top.x, top.y - 14); c.lineTo(top.x + Math.cos(a0) * R, top.y + 10 + Math.sin(a0) * 4); c.lineTo(top.x + Math.cos(a1) * R, top.y + 10 + Math.sin(a1) * 4); c.closePath(); c.fill(); c.stroke();
      }
      c.fillStyle = '#ff8fae'; c.beginPath(); c.arc(top.x, top.y - 15, 2.5, 0, Math.PI * 2); c.fill();
      if (WINTER) { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(top.x, top.y - 6, 26, 5, 0, Math.PI, 0); c.fill(); }
    }

    futon(x, y, col) {
      this.box(x, y, 0, 1.25, 0.9, 0.1, col, this.shade(col, -10), this.shade(col, -20));
      this.box(x + 0.08, y + 0.1, 0.1, 0.3, 0.7, 0.1, '#fffdf8', '#f1e6da', '#e6d8c9');
      const P = (a, b, cc) => this.iso(a, b, cc);
      this.poly([P(x + 0.45, y + 0.05, 0.12), P(x + 1.25, y + 0.05, 0.12), P(x + 1.25, y + 0.9, 0.12), P(x + 0.45, y + 0.9, 0.12)], this.shade(col, 12), this.pal.ink, 0.8);
      const c = this.ctx, q = this.iso(x + 0.85, y + 0.5, 0.12);
      c.fillStyle = 'rgba(255,255,255,.7)'; for (const [ox, oy] of [[-8, 0], [0, -3], [8, 1], [-2, 4]]) { c.beginPath(); c.arc(q.x + ox, q.y + oy, 1.6, 0, Math.PI * 2); c.fill(); }
    }

    bush(x, y) {
      const c = this.ctx, q = this.iso(x, y, 0);
      c.fillStyle = 'rgba(120,80,60,.14)'; c.beginPath(); c.ellipse(q.x, q.y, 16, 7, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = this.pal.ink; c.lineWidth = 0.9;
      const g = WINTER ? ['#a9d39b', '#bfe0b2'] : ['#8fcf86', '#a8dc9c'];
      for (const [ox, oy, r, k] of [[-8, -6, 9, 0], [8, -6, 9, 0], [0, -12, 10, 1]]) { c.fillStyle = g[k]; c.beginPath(); c.arc(q.x + ox, q.y + oy, r, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.fillStyle = g[1]; for (const [ox, oy, r] of [[-8, -6, 8], [8, -6, 8], [0, -12, 9]]) { c.beginPath(); c.arc(q.x + ox, q.y + oy, r, 0, Math.PI * 2); c.fill(); }
      if (WINTER) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(q.x, q.y - 20, 8, 3, 0, 0, Math.PI * 2); c.fill(); }
      else { c.fillStyle = '#ffb3c6'; for (const [ox, oy] of [[-9, -8], [6, -13], [9, -4]]) { c.beginPath(); c.arc(q.x + ox, q.y + oy, 2, 0, Math.PI * 2); c.fill(); } }
    }

    // ------------------------------------------------------------ paper office
    // "Milk-tea paper" (cute palette): a small studio drawn in brown pen and pale
    // watercolour on warm paper. Desks along the back, an empty aisle through
    // the middle, a rest corner and a review table at the front, the big
    // seasonal tree front and centre.
    buildPaper(nWorking) {
      // 2-person desk islands along the back (4 per row) + 4 focus desks.
      const rows = Math.max(1, Math.ceil(Math.max(0, nWorking + 2 - 4) / 8));
      const islands = rows * 4;
      const workBottom = 1.4 + (rows - 1) * 3.3 + 2.6;
      const A = workBottom + 1.7;            // the aisle ends, the front zones start
      const W = 17.2, D = A + 7.4;
      const grid = new Grid(W, D);
      const items = [], pois = [], desks = [], props = [], washes = [];
      const add = (depth, draw) => items.push({ depth, draw });
      const solid = (x, y, w, d, pad) => grid.block(x, y, w, d, pad);
      const poi = (x, y, act, face, opt = {}) => pois.push({ x, y, act, face, sit: 0, ...opt });
      const TONE = ['#e8d8c3', '#b8c7b0', '#e9b8aa', '#d9cfe0'];

      // ---- shared desks: islands of two, face to face
      for (let i = 0; i < islands; i++) {
        const r = Math.floor(i / 4), k = i % 4;
        const x = 1.7 + k * 2.6, y = 1.4 + r * 3.3;
        const col = TONE[(i + r) % TONE.length];
        desks.push({ x, y, side: 'n', seat: { x: x + 0.7, y: y - 0.45 }, col });
        desks.push({ x, y: y + 0.92, side: 's', seat: { x: x + 0.7, y: y + 0.92 + 1.25 }, col });
        solid(x, y, 1.4, 1.72, 0.08);
      }
      washes.push({ x: 6.3, y: workBottom / 2 + 0.3, rx: 6.2, ry: workBottom / 2 + 0.5, col: 'rgba(184,199,176,.20)' });

      // ---- focus desks: single desks with low partitions (back right)
      const FX = 13.1;
      for (const [fx, fy] of [[FX, 1.2], [FX + 2.0, 1.2], [FX, 3.4], [FX + 2.0, 3.4]]) {
        desks.push({ x: fx, y: fy, side: 'n', seat: { x: fx + 0.7, y: fy - 0.45 }, col: '#e8d8c3', focus: true });
        solid(fx, fy, 1.4, 0.8, 0.08);
      }
      const panel = '#b8c7b0';
      add(FX + 1.7 + 2.3, () => this.box(FX - 0.1, 2.25, 0, 3.6, 0.08, 0.8, this.shade(panel, 18), panel, this.shade(panel, -12)));
      add(FX + 1.75 + 2.5, () => this.box(FX + 1.6, 0.9, 0, 0.08, 3.6, 0.8, this.shade(panel, 18), panel, this.shade(panel, -12)));
      solid(FX - 0.1, 2.2, 3.6, 0.15, 0.03);
      solid(FX + 1.58, 0.9, 0.12, 3.6, 0.03);
      washes.push({ x: FX + 1.7, y: 2.5, rx: 2.4, ry: 2.4, col: 'rgba(217,207,224,.22)' });

      // ---- coffee nook on the back wall between the two
      add(11.3 + 0.45, () => this.waterCooler(11.1, 0.22));
      solid(11.05, 0.2, 0.5, 0.5);
      add(11.7 + 0.5 + 0.5, () => { this.paperCounter(11.65, 0.2, 1.15, 0.6); this.coffeeMachine(11.8, 0.25); });
      solid(11.65, 0.2, 1.15, 0.6);
      poi(11.3, 1.1, 'water', 'back');
      poi(12.2, 1.25, 'coffee', 'back', { w: 1.5 });

      // ---- along the back-left wall: low bookshelf and the notice board
      add(0.3 + 1.0 + 1.2, () => this.lowShelfY(0.12, 0.9, 2.4));
      solid(0.1, 0.9, 0.5, 2.4);
      poi(1.05, 1.5, 'read', 'back');
      poi(1.05, 2.8, 'read', 'back');
      const board = { y: workBottom + 0.1, len: 1.2 };
      poi(0.95, board.y + 0.6, 'board', 'back', { w: 1.4 });
      for (const [px, py] of [[0.55, 0.45], [W - 0.5, 0.45]]) { add(px + py, () => this.plant(px, py)); solid(px - 0.22, py - 0.22, 0.44, 0.44); }

      // ---- rest corner (front left): sofa, low table, beanbags, rug
      const RX = 1.2, RY = A + 0.1;
      washes.push({ x: RX + 2.4, y: RY + 2.0, rx: 2.9, ry: 2.2, col: 'rgba(233,184,170,.22)' });
      add(RX + 1.4 + RY, () => this.couch(RX, RY));
      solid(RX, RY, 2.8, 0.8);
      for (let k = 0; k < 3; k++) poi(RX + 0.5 + k * 0.9, RY + 0.6, 'couch', 'front', { sit: 0.36 });
      add(RX + 0.6 + 0.8 + RY + 1.75, () => this.coffeeTable(RX + 0.6, RY + 1.4));
      solid(RX + 0.6, RY + 1.4, 1.6, 0.7);
      for (const [bx, by, col] of [[RX + 3.7, RY + 0.9, '#e9b8aa'], [RX + 3.5, RY + 2.3, '#b8c7b0']]) {
        add(bx + by, () => this.beanbag(bx, by, col));
        poi(bx, by, 'beanbag', 'front', { sit: 0.18 });
      }

      // ---- review table (front right): finished work gets looked over here
      const VX = 11.2, VY = A + 0.9;
      washes.push({ x: VX + 1.6, y: VY + 0.6, rx: 2.6, ry: 1.9, col: 'rgba(231,198,107,.16)' });
      add(VX + 1.5 + VY + 0.5, () => this.reviewTable(VX, VY));
      solid(VX, VY, 3.0, 1.0);
      for (let k = 0; k < 3; k++) {
        const cx = VX + 0.5 + k * 1.0;
        add(cx + VY - 0.42, () => this.paperStool(cx, VY - 0.4));
        add(cx + VY + 1.42, () => this.paperStool(cx, VY + 1.4));
        poi(cx, VY - 0.4, 'review', 'front', { sit: 0.42 });
        poi(cx, VY + 1.4, 'review', 'back', { sit: 0.42 });
      }

      // ---- the seasonal tree, front and centre, with snowmen
      const tx = 8.4, ty = A + 1.9;
      let tree = null;
      if (XMAS) {
        tree = { x: tx, y: ty };
        add(tx + ty + 0.3, () => this.gptTree(tx, ty));
        poi(tx - 1.6, ty + 1.2, 'xmas', 'back', { w: 2 });
        poi(tx + 1.4, ty + 1.3, 'xmas', 'back', { w: 2 });
        poi(tx - 0.2, ty + 1.7, 'xmas', 'back', { w: 2 });
      } else {
        add(tx + ty, () => this.plant(tx, ty));
      }
      solid(tx - 1.0, ty - 1.0, 2.0, 2.0, 0.05);

      // ---- game corner along the front: ping-pong, foosball, arcades, claw machine
      const G = A + 4.6;
      washes.push({ x: 9.5, y: G + 1.4, rx: 6.0, ry: 1.7, col: 'rgba(231,198,107,.14)' });
      const px = 4.6, py = G + 0.5;
      add(px + 1.3 + py + 0.7, () => this.pingpong(px, py));
      solid(px, py, 2.6, 1.4, 0.05);
      poi(px - 0.5, py + 0.7, 'pingpong', 'side', { pair: 'pp' });
      poi(px + 3.1, py + 0.7, 'pingpong', 'side', { pair: 'pp' });
      const pp = { x0: px - 0.2, x1: px + 2.8, y: py + 0.7 };
      const fbx = 9.6, fby = G + 1.0;
      add(fbx + 0.8 + fby + 0.4, () => this.foosball(fbx, fby));
      solid(fbx, fby, 1.6, 0.8, 0.05);
      poi(fbx - 0.45, fby + 0.4, 'foosball', 'side', { pair: 'fb' });
      poi(fbx + 2.05, fby + 0.4, 'foosball', 'side', { pair: 'fb' });
      for (const ax of [13.0, 13.9]) {
        add(ax + 0.35 + G + 0.35, () => this.arcade(ax, G));
        solid(ax, G, 0.7, 0.7);
        poi(ax + 0.35, G + 1.15, 'arcade', 'back');
      }
      add(15.4 + 0.4 + G + 0.4, () => this.clawMachine(15.4, G));
      solid(15.4, G, 0.8, 0.8);
      poi(15.8, G + 1.25, 'claw', 'back', { w: 1.5 });

      // ---- bungeoppang cart by the door in winter
      const door = { x: 0.4, y: D - 1.1 };
      if (WINTER) {
        const bx = 1.6, by = D - 1.55;
        this.pojangmacha(add, bx, by);
        solid(bx, by, 1.5, 0.75, 0.05);
        poi(bx + 0.75, by - 0.5, 'bake', 'front', { w: 3 });
        poi(bx + 0.35, by + 1.2, 'bungeo', 'back', { w: 4 });
        poi(bx + 1.15, by + 1.2, 'bungeo', 'back', { w: 4 });
      }

      return {
        W, D, OW: W, OD: workBottom, MR: 0, PY: A, RW: 0, GX: W, pods: rows === 1 ? 2 : islands / 2 + 1,
        tree, washes, board, village: true, paper: true, WH: 1.25,
        grid, items, props, pois, desks, windows: [], posters: [], pp, door,
      };
    }

    // Paper floor, low walls, watercolour washes.
    paperRoom() {
      const { W, D, washes = [], board } = this.plan;
      const P = (x, y, z) => this.iso(x, y, z);
      const c = this.ctx, t = this.t / 1000;
      const ink = 'rgba(112,88,74,.55)';
      const rnd = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      // the paper board everything stands on, with a little thickness
      const T = 0.28;
      this.poly([P(0, D, 0), P(W, D, 0), P(W, D, -T), P(0, D, -T)], 'rgba(216,196,171,1)', ink, 1);
      this.poly([P(W, 0, 0), P(W, D, 0), P(W, D, -T), P(W, 0, -T)], 'rgba(201,179,150,1)', ink, 1);
      this.poly([P(0, 0), P(W, 0), P(W, D), P(0, D)], 'rgba(250,246,237,1)', ink, 1.2);
      // sparse planks, very faint
      for (let y = 1.1; y < D - 0.2; y += 1.1) this.poly([P(0, y), P(W, y), P(W, y + 0.012), P(0, y + 0.012)], 'rgba(150,120,95,.10)');
      // watercolour washes under each zone: a few soft overlapping blots
      for (const [i, w] of washes.entries()) {
        for (let k = 0; k < 5; k++) {
          const ox = (rnd(i * 9 + k) - 0.5) * w.rx * 0.5, oy = (rnd(i * 9 + k + 4) - 0.5) * w.ry * 0.5;
          const s = 0.7 + rnd(i * 9 + k + 2) * 0.35;
          const pts = [];
          for (let a = 0; a < 24; a++) {
            const ang = a / 24 * Math.PI * 2, wob = 1 + (rnd(i * 50 + k * 24 + a) - 0.5) * 0.12;
            pts.push(P(w.x + ox + Math.cos(ang) * w.rx * s * wob, w.y + oy + Math.sin(ang) * w.ry * s * wob));
          }
          this.poly(pts, w.col);
        }
      }
      // paper grain
      c.fillStyle = 'rgba(112,88,74,.07)';
      for (let i = 0; i < W * D * 3; i++) { const q = P(rnd(i) * W, rnd(i + 77) * D); c.fillRect(q.x, q.y, 1, 1); }

      // ---- low walls on the two back sides
      const WH = this.plan.WH;
      const dy = this.plan.door.y;
      const wall = (len, at, gap) => {
        const seg = (u0, u1) => {
          if (u1 - u0 < 0.02) return;
          this.poly([at(u0, 0), at(u1, 0), at(u1, WH), at(u0, WH)], 'rgba(243,235,221,1)', ink, 1);
          this.poly([at(u0, 0), at(u1, 0), at(u1, 0.1), at(u0, 0.1)], 'rgba(216,196,171,1)');
        };
        if (gap) { seg(0, gap[0]); seg(gap[1], len); } else seg(0, len);
      };
      wall(W, (u, z) => P(u, 0, z));
      wall(D, (u, z) => P(0, u, z), [dy - 0.6, dy + 0.6]);
      // wall caps
      this.poly([P(-0.14, -0.14, WH), P(W, -0.14, WH), P(W, 0, WH), P(0, 0, WH)], 'rgba(232,216,195,1)', ink, 1);
      this.poly([P(-0.14, -0.14, WH), P(0, 0, WH), P(0, dy - 0.6, WH), P(-0.14, dy - 0.6, WH)], 'rgba(232,216,195,1)', ink, 1);
      this.poly([P(-0.14, dy + 0.6, WH), P(0, dy + 0.6, WH), P(0, D, WH), P(-0.14, D, WH)], 'rgba(232,216,195,1)', ink, 1);
      // door frame and mat
      for (const g of [dy - 0.62, dy + 0.56]) this.poly([P(0, g, 0), P(0, g + 0.06, 0), P(0, g + 0.06, 1.85), P(0, g, 1.85)], 'rgba(216,189,152,1)', ink, 0.9);
      this.poly([P(0, dy - 0.62, 1.8), P(0, dy + 0.62, 1.8), P(0, dy + 0.62, 1.95), P(0, dy - 0.62, 1.95)], 'rgba(216,189,152,1)', ink, 0.9);
      this.poly([P(0.05, dy - 0.5), P(0.8, dy - 0.5), P(0.8, dy + 0.5), P(0.05, dy + 0.5)], 'rgba(233,184,170,.6)', ink, 0.8);
      // little framed watercolours and a clock on the back wall
      const frame = (u, z, w, h, draw) => {
        this.poly([P(u, 0, z), P(u + w, 0, z), P(u + w, 0, z + h), P(u, 0, z + h)], 'rgba(250,246,237,1)', 'rgba(112,88,74,.7)', 1.4);
        this.onWall('y0', u + 0.06, z + h - 0.06, draw);
      };
      const land = (cc, w) => {
        cc.fillStyle = 'rgba(184,199,176,.8)'; cc.beginPath(); cc.moveTo(0, 14); cc.quadraticCurveTo(w * 0.3, 2, w * 0.6, 10); cc.quadraticCurveTo(w * 0.8, 4, w, 9); cc.lineTo(w, 16); cc.lineTo(0, 16); cc.fill();
        cc.fillStyle = 'rgba(233,184,170,.8)'; cc.beginPath(); cc.arc(w * 0.75, 4, 3, 0, Math.PI * 2); cc.fill();
      };
      frame(2.6, 0.5, 0.75, 0.55, (cc) => land(cc, 18));
      frame(5.3, 0.55, 0.6, 0.45, (cc) => { cc.fillStyle = 'rgba(217,207,224,.9)'; cc.beginPath(); cc.arc(9, 7, 6, 0, Math.PI * 2); cc.fill(); cc.fillStyle = 'rgba(231,198,107,.9)'; cc.beginPath(); cc.arc(9, 7, 2.5, 0, Math.PI * 2); cc.fill(); });
      frame(8.0, 0.5, 0.75, 0.55, (cc) => { cc.fillStyle = 'rgba(184,199,176,.85)'; for (let i = 0; i < 3; i++) { cc.beginPath(); cc.ellipse(4 + i * 6, 10 - (i % 2) * 3, 2.5, 6, 0, 0, Math.PI * 2); cc.fill(); } });
      this.onWall('y0', 10.4, 0.95, (cc) => {
        cc.beginPath(); cc.arc(0, 0, 9, 0, Math.PI * 2); cc.fillStyle = '#faf6ed'; cc.fill(); cc.lineWidth = 1.4; cc.strokeStyle = 'rgba(112,88,74,.75)'; cc.stroke();
        const d = new Date();
        const hand = (ang, l, w) => { cc.beginPath(); cc.moveTo(0, 0); cc.lineTo(Math.sin(ang) * l, -Math.cos(ang) * l); cc.lineWidth = w; cc.strokeStyle = '#70584a'; cc.stroke(); };
        hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, 4.5, 1.8);
        hand((d.getMinutes() / 60) * Math.PI * 2, 6.8, 1.2);
      });
      // the notice board on the left wall
      if (board) {
        const b0 = board.y, b1 = board.y + board.len;
        this.poly([P(0, b0, 0.4), P(0, b1, 0.4), P(0, b1, 1.1), P(0, b0, 1.1)], 'rgba(216,189,152,1)', 'rgba(112,88,74,.7)', 1.4);
        const o = this.iso(0, b1, 0);
        c.save(); c.translate(o.x, o.y); c.transform(1, -0.5, 0, 1, 0, 0);
        const L = board.len * TW / 2;
        const notes = [['#faf6ed', '할 일'], ['#e9b8aa', '버그'], ['#b8c7b0', '리뷰'], ['#f3e3b0', '배포']];
        notes.forEach(([bg, txt], i) => {
          const nx = 4 + (i % 2) * (L * 0.48), nz = -(1.0 - Math.floor(i / 2) * 0.28) * TH;
          c.fillStyle = bg; c.fillRect(nx, nz, L * 0.4, 8);
          c.strokeStyle = 'rgba(112,88,74,.4)'; c.lineWidth = 0.6; c.strokeRect(nx, nz, L * 0.4, 8);
          c.fillStyle = '#70584a'; c.font = '700 5.5px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(txt, nx + L * 0.2, nz + 4.5);
        });
        c.restore();
      }
      if (this.plan.tree) this.treeSkirt(this.plan.tree.x, this.plan.tree.y);
      void t;
    }

    paperCounter(x, y, w, d) {
      this.box(x, y, 0, w, d, 0.85, '#faf6ed', '#e8d8c3', '#d8c4ab');
      this.box(x - 0.02, y - 0.02, 0.85, w + 0.04, d + 0.04, 0.06, '#faf6ed', '#e8d8c3', '#d8c4ab');
    }

    paperStool(x, y) {
      this.cyl(x, y, 0, 0.06, 0.38, '#d8c4ab', '#d8c4ab');
      this.cyl(x, y, 0.36, 0.24, 0.07, '#e8d8c3', '#d8c4ab');
    }

    // Low bookshelf standing against the left wall (books face +x).
    lowShelfY(x, y, len) {
      this.box(x, y, 0, 0.45, len, 1.0, '#e8d8c3', '#d8c4ab', '#faf6ed');
      const P = (a, b, cc) => this.iso(a, b, cc);
      const cols = ['#e9b8aa', '#b8c7b0', '#d8bd98', '#d9cfe0', '#e7c66b'];
      for (const z0 of [0.12, 0.56]) {
        let yy = y + 0.08, i = Math.floor(z0 * 10);
        while (yy < y + len - 0.12) {
          const w = 0.09 + ((i * 7) % 4) * 0.025, h = 0.3 + ((i * 5) % 3) * 0.05;
          this.poly([P(x + 0.45, yy, z0), P(x + 0.45, yy + w, z0), P(x + 0.45, yy + w, z0 + h), P(x + 0.45, yy, z0 + h)], cols[i % cols.length], 'rgba(112,88,74,.4)', 0.6);
          yy += w + 0.02; i++;
          if (i % 7 === 3) yy += 0.18;
        }
      }
    }

    reviewTable(x, y) {
      for (const [lx, ly] of [[0.25, 0.2], [2.75, 0.2], [0.25, 0.8], [2.75, 0.8]]) this.cyl(x + lx, y + ly, 0, 0.05, 0.72, '#b8c7b0', '#b8c7b0');
      this.box(x, y, 0.72, 3.0, 1.0, 0.07, '#faf6ed', '#e8d8c3', '#d8c4ab');
      const P = (a, b, cc) => this.iso(a, b, cc);
      // papers with red-pen marks, a laptop, a mug, a "검토" tent card
      for (const [px, py, r] of [[0.5, 0.25, 0.1], [0.9, 0.45, -0.1], [2.0, 0.3, 0.05]]) {
        this.poly([P(x + px, y + py, 0.795), P(x + px + 0.4, y + py + r, 0.795), P(x + px + 0.4, y + py + r + 0.3, 0.795), P(x + px, y + py + 0.3, 0.795)], '#ffffff', 'rgba(112,88,74,.4)', 0.6);
        const q = this.iso(x + px + 0.2, y + py + 0.15, 0.8), c = this.ctx;
        c.strokeStyle = 'rgba(214,90,80,.8)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(q.x - 4, q.y); c.lineTo(q.x + 3, q.y - 1); c.moveTo(q.x - 3, q.y + 2); c.lineTo(q.x + 1, q.y + 2); c.stroke();
      }
      this.box(x + 1.3, y + 0.35, 0.79, 0.5, 0.35, 0.02, '#d8c4ab', '#c9b396', '#bca686');
      this.poly([P(x + 1.3, y + 0.35, 0.81), P(x + 1.8, y + 0.35, 0.81), P(x + 1.8, y + 0.35, 1.1), P(x + 1.3, y + 0.35, 1.1)], '#e8d8c3', 'rgba(112,88,74,.5)', 0.8);
      this.cyl(x + 2.6, y + 0.65, 0.79, 0.06, 0.12, '#7a4e33', '#e9b8aa');
      const t0 = this.iso(x + 2.35, y + 0.2, 0.79), c = this.ctx;
      c.fillStyle = '#faf6ed'; c.strokeStyle = 'rgba(112,88,74,.7)'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(t0.x - 9, t0.y); c.lineTo(t0.x - 7, t0.y - 11); c.lineTo(t0.x + 7, t0.y - 11); c.lineTo(t0.x + 9, t0.y); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#70584a'; c.font = '800 6px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('검토', t0.x, t0.y - 5.5);
    }

    glassX(add, x, y, d) {
      if (BARE) return;
      if (this.pal.cute) { add(x + y + d / 2 + 0.02, () => this.fenceRun((u, z) => this.iso(x, y + u, z), d, 0.62)); return; }
      add(x + y + d / 2 + 0.02, () => {
        const P = (a, b, c) => this.iso(a, b, c);
        this.poly([P(x, y, 0), P(x, y + d, 0), P(x, y + d, 0.22), P(x, y, 0.22)], this.pal.trim);
        this.poly([P(x, y, 0.22), P(x, y + d, 0.22), P(x, y + d, 2.1), P(x, y, 2.1)], this.pal.glass, this.pal.glassEdge);
      });
    }

    glassY(add, x, y, w) {
      if (BARE) return;
      if (this.pal.cute) { add(x + w / 2 + y + 0.02, () => this.fenceRun((u, z) => this.iso(x + u, y, z), w, 0.62)); return; }
      add(x + w / 2 + y + 0.02, () => {
        const P = (a, b, c) => this.iso(a, b, c);
        this.poly([P(x, y, 0), P(x + w, y, 0), P(x + w, y, 0.22), P(x, y, 0.22)], this.pal.trim);
        this.poly([P(x, y, 0.22), P(x + w, y, 0.22), P(x + w, y, 2.1), P(x, y, 2.1)], this.pal.glass, this.pal.glassEdge);
      });
    }

    // ------------------------------------------------------------ sessions → people

    update(sessions) {
      // Extras need the character sheets; run again once they've loaded.
      this.lastSessions = sessions;
      if (!CHARS.length && !this.waitSprites) {
        this.waitSprites = true;
        spritesReady.then(() => { if (CHARS.length && this.lastSessions) this.update(this.lastSessions); });
      }
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
        const star = WORKAHOLIC >= 0 && WORKAHOLIC < CHARS.length ? WORKAHOLIC : -1;
        // The workaholic gets a working session whenever one exists.
        if (star >= 0 && Date.now() > (this.starSwap || 0)) {
          const holder = real.find((p) => p.charIdx === star);
          if (!holder || !WORKING.has(holder.s.status)) {
            const w = real.find((p) => p !== holder && WORKING.has(p.s.status));
            if (w) {
              if (holder) holder.charIdx = w.charIdx ?? null;
              else if (w.charIdx != null) taken.delete(w.charIdx);
              w.charIdx = star; taken.add(star);
              this.starSwap = Date.now() + 15000;
            }
          }
        }
        for (const p of real) {
          if (p.charIdx != null) continue;
          if (star >= 0 && !taken.has(star) && WORKING.has(p.s.status)) { p.charIdx = star; taken.add(star); continue; }
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
          // A session that just went away (finished, deleted, taken out) keeps
          // its character in the office as an extra instead of walking out.
          const was = !p && [...this.people.values()].find((q) => q.charIdx === i && !shown.has(q.key) && !q.s.npc);
          if (was) {
            this.people.delete(was.key);
            this.release(was);
            was.key = key;
            was.s = { key, status: 'done', npc: true, agent: 'claude', title: '' };
            was.mode = null; was.desk = null; was.shift = false; was.path = [];
            this.people.set(key, (p = was));
          }
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
      let room = Math.min(free.length - 1, Math.ceil(npcs.length / 3) - npcs.filter((p) => p.mode === 'work' && p.charIdx !== WORKAHOLIC).length);
      // The workaholic goes first and doesn't count against the limit.
      const star = npcs.findIndex((p) => p.charIdx === WORKAHOLIC);
      if (star > 0) npcs.unshift(npcs.splice(star, 1)[0]);
      for (const p of npcs) {
        const isStar = p.charIdx === WORKAHOLIC;
        if (isStar && room <= 0 && free.length > 1) room = 1;
        if (room <= 0) break;
        if (p.mode !== 'wander' || p.path.length || now < (p.nextShift ??= now + (isStar ? 1 : rand(3, 25)) * 1000)) continue;
        const d = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        if (!d) break;
        this.release(p);
        if (p.napDesk) { p.napDesk.napper = null; p.napDesk = null; }
        p.mode = 'work';
        p.shift = true;
        p.desk = d;
        d.npcWorker = p.key;
        p.shiftEnd = now + (isStar ? rand(120, 240) : rand(30, 90)) * 1000;
        p.capSeed = Math.random();
        this.goTo(p, d.seat);
        room--;
      }
    }

    endShift(p, now) {
      if (p.desk && p.desk.npcWorker === p.key) p.desk.npcWorker = null;
      p.mode = 'wander';
      p.shift = false;
      p.desk = null; p.poi = null; p.until = 0;
      p.nextShift = now + (p.charIdx === WORKAHOLIC ? rand(5, 15) : rand(20, 60)) * 1000;
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
        let w = q.w || 1;
        if (q.pair) w = plan.pois.some((o) => o.pair === q.pair && o !== q && o.taken) ? 7 : 1.2;
        if (q.act === 'couch' || q.act === 'beanbag' || q.sleepy) w = sleepy ? 3 : 1.4;
        if (q.act === 'review' && p.s.status === 'done' && now - (p.s.lastEventAt || 0) < 10 * 60_000) w = 6; // fresh work gets reviewed
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
      // Something to do right where they are: dance, stretch, phone, a snack…
      for (let k = 0; k < 2; k++) {
        const fx = rand(1, plan.W - 1), fy = rand(1, plan.D - 1);
        if (plan.grid.blocked(fx, fy)) continue;
        weighted.push([{ x: fx, y: fy, act: FLOOR_ACTS[Math.floor(Math.random() * FLOOR_ACTS.length)], face: 'front' }, 1.3]);
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
      p.stay = (choice.act === 'nap' ? rand(20, 45) : choice.act === 'pingpong' ? rand(12, 25) : choice.act === 'pet' ? rand(6, 12) : FLOOR_ACTS.includes(choice.act) ? rand(5, 10) : rand(6, 14)) * 1000;
      p.capSeed = Math.random();
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
      if (this.plan.paper) { this.paperRoom(); if (XMAS) this.gptWalls(); return; }
      if (this.pal.cute) { this.villageRoom(); if (XMAS) this.xmasWalls(); return; }
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
      if (this.plan.tree) this.treeSkirt(this.plan.tree.x, this.plan.tree.y);

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
        if (WINTER) {
          // snow falling past the window
          const c = this.ctx;
          c.fillStyle = 'rgba(255,255,255,.95)';
          for (let i = 0; i < 7; i++) {
            const fx = x + 0.08 + ((i * 0.371 + Math.sin(t * 0.6 + i) * 0.03) % 1) * 1.34;
            const fz = 1.97 - ((t * 0.12 + i * 0.173) % 1) * 1.08;
            const q = P(fx, 0, fz);
            c.beginPath(); c.arc(q.x, q.y, 1.3, 0, Math.PI * 2); c.fill();
          }
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
      if (XMAS) this.xmasWalls();
    }

    // ------------------------------------------------------------ village

    // A cosy village instead of an office shell: a grassy meadow, wooden decks
    // under the desks, a picket fence with sky and rolling hills beyond it (the
    // sky follows the real time of day), a flower-arch gate, a pond and a
    // weeding patch.
    villageRoom() {
      const { W, D, patches = [], pond, weeds, pp } = this.plan;
      const pal = this.pal;
      const P = (x, y, z) => this.iso(x, y, z);
      const c = this.ctx, t = this.t / 1000;
      const rnd = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

      // ---- walls: sky, hills, little houses, fence
      this.villageWall(W, (u, z) => P(u, 0, z), 0, null);
      this.villageWall(D, (u, z) => P(0, u, z), 3, this.plan.door.y);

      // ---- one continuous lawn (no tiles): soft light and shade patches,
      // then blades of grass and wild flowers on top
      this.poly([P(0, 0), P(W, 0), P(W, D), P(0, D)], 'rgba(190,226,154,1)');
      c.save();
      c.beginPath(); const q0 = [P(0, 0), P(W, 0), P(W, D), P(0, D)]; c.moveTo(q0[0].x, q0[0].y); for (const q of q0) c.lineTo(q.x, q.y); c.closePath(); c.clip();
      for (let i = 0; i < W * D * 0.35; i++) {
        const q = P(rnd(i + 1) * W, rnd(i + 2) * D), r = 18 + rnd(i + 3) * 30;
        c.fillStyle = i % 2 ? 'rgba(214,240,178,.35)' : 'rgba(160,206,128,.22)';
        c.beginPath(); c.ellipse(q.x, q.y, r, r * 0.5, 0, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      const covered = (x, y) => patches.some((pa) => pa.kind === 'oval'
        ? ((x - pa.x) / pa.rx) ** 2 + ((y - pa.y) / pa.ry) ** 2 < 1
        : x > pa.x0 && x < pa.x1 && y > pa.y0 && y < pa.y1);
      const FL = ['#ffffff', '#ffc7d6', '#fff3a6', '#d9c7ff'];
      for (let i = 0; i < W * D * 1.6; i++) {
        const x = 0.2 + rnd(i) * (W - 0.4), y = 0.2 + rnd(i + 999) * (D - 0.4);
        if (covered(x, y)) continue;
        const q = P(x, y);
        if (i % 9 === 0) {
          c.fillStyle = FL[i % FL.length];
          for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; c.beginPath(); c.arc(q.x + Math.cos(a) * 1.8, q.y + Math.sin(a) * 1.1 - 1, 1.2, 0, Math.PI * 2); c.fill(); }
          c.fillStyle = '#f5b83d'; c.beginPath(); c.arc(q.x, q.y - 1, 0.9, 0, Math.PI * 2); c.fill();
        } else {
          const g = 120 + Math.floor(rnd(i + 7) * 50);
          c.strokeStyle = `rgba(${g - 30},${g + 50},${g - 40},.7)`; c.lineWidth = 1; c.lineCap = 'round';
          c.beginPath(); c.moveTo(q.x - 1.5, q.y); c.lineTo(q.x - 2.5, q.y - 3); c.moveTo(q.x, q.y); c.lineTo(q.x + 0.3, q.y - 4); c.moveTo(q.x + 1.5, q.y); c.lineTo(q.x + 2.6, q.y - 3); c.stroke();
        }
      }
      this.poly([P(0, 0), P(W, 0), P(W, D), P(0, D)], null, pal.ink, 1.4);

      // ---- patches: rugs under the islands, decks for café and lounge, play mat
      for (const pa of patches) {
        if (pa.kind === 'oval') {
          const ring = (k) => { const pts = []; for (let a = 0; a < 32; a++) pts.push(P(pa.x + Math.cos(a / 32 * Math.PI * 2) * pa.rx * k, pa.y + Math.sin(a / 32 * Math.PI * 2) * pa.ry * k)); return pts; };
          this.poly(ring(1), pa.col, pal.ink, 1);
          this.poly(ring(0.86), null, 'rgba(255,255,255,.8)', 1.4);
        } else if (pa.kind === 'deck') {
          const { x0, y0, x1, y1, col } = pa, h = 0.05;
          this.poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)], this.shade(col, -28), pal.ink, 0.8);
          this.poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], col, pal.ink, 0.9);
          for (let y = y0 + 0.34; y < y1 - 0.05; y += 0.34) this.poly([P(x0, y, h), P(x1, y, h), P(x1, y + 0.015, h), P(x0, y + 0.015, h)], 'rgba(185,135,95,.28)');
        } else if (pa.kind === 'rug') {
          const { x0, y0, x1, y1, col } = pa;
          this.poly([P(x0, y0, 0.06), P(x1, y0, 0.06), P(x1, y1, 0.06), P(x0, y1, 0.06)], col, pal.ink, 0.9);
          this.poly([P(x0 + 0.2, y0 + 0.2, 0.06), P(x1 - 0.2, y0 + 0.2, 0.06), P(x1 - 0.2, y1 - 0.2, 0.06), P(x0 + 0.2, y1 - 0.2, 0.06)], null, 'rgba(255,255,255,.85)', 1.4);
        } else if (pa.kind === 'mat') {
          const { x0, y0, x1, y1, col } = pa;
          this.poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], col, 'rgba(255,255,255,.8)', 1.4);
        }
      }

      // ---- stepping-stone path from the gate into the village
      const path = this.plan.path || [];
      let n = 0;
      for (let k = 0; k < path.length - 1; k++) {
        const [ax, ay] = path[k], [bx, by] = path[k + 1];
        const len = Math.hypot(bx - ax, by - ay);
        for (let u = 0; u < len; u += 0.62) {
          const x = ax + (bx - ax) * u / len + (rnd(n) - 0.5) * 0.12, y = ay + (by - ay) * u / len + (rnd(n + 50) - 0.5) * 0.12;
          n++;
          if (this.plan.grid.blocked(x, y)) continue;
          const pts = [];
          for (let a = 0; a < 10; a++) pts.push(P(x + Math.cos(a / 10 * Math.PI * 2) * 0.24, y + Math.sin(a / 10 * Math.PI * 2) * 0.2));
          this.poly(pts, 'rgba(240,233,220,1)', 'rgba(150,125,100,.45)', 0.9);
        }
      }

      // ---- weeding patch: tall wild grass to pull
      if (weeds) {
        const { x0, y0, x1, y1 } = weeds;
        this.poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], 'rgba(178,214,132,1)', 'rgba(120,160,80,.5)', 1);
        for (let i = 0; i < 70; i++) {
          const x = x0 + 0.1 + rnd(i + 300) * (x1 - x0 - 0.2), y = y0 + 0.1 + rnd(i + 700) * (y1 - y0 - 0.2);
          const q = P(x, y), sw = Math.sin(t * 1.8 + i) * 1.4, h = 7 + rnd(i + 5) * 6;
          c.strokeStyle = i % 3 ? 'rgba(98,158,70,1)' : 'rgba(132,186,92,1)'; c.lineWidth = 1.3; c.lineCap = 'round';
          c.beginPath();
          c.moveTo(q.x - 2, q.y); c.quadraticCurveTo(q.x - 3, q.y - h / 2, q.x - 4 + sw, q.y - h);
          c.moveTo(q.x, q.y); c.quadraticCurveTo(q.x, q.y - h / 2, q.x + sw, q.y - h - 2);
          c.moveTo(q.x + 2, q.y); c.quadraticCurveTo(q.x + 3, q.y - h / 2, q.x + 4 + sw, q.y - h + 1);
          c.stroke();
          if (i % 9 === 0) { c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(q.x + sw, q.y - h - 3, 1.6, 0, Math.PI * 2); c.fill(); }
        }
        // a little sign: 풀뽑기
        const s = P(x0 + 0.1, y0 + 0.05, 0);
        c.fillStyle = '#b8835a'; c.fillRect(s.x - 1, s.y - 20, 2, 20);
        this.roundRect(s.x - 15, s.y - 30, 30, 12, 3, '#fff3dc', '#a8774f');
        c.fillStyle = '#6b4a3a'; c.font = '800 7px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('풀뽑기', s.x, s.y - 23.5);
      }

      // ---- pond with lily pads and a frog
      if (pond) {
        const { x, y, rx, ry } = pond;
        const ring = (k, dz = 0) => { const pts = []; for (let a = 0; a < 28; a++) pts.push(P(x + Math.cos(a / 28 * Math.PI * 2) * rx * k, y + Math.sin(a / 28 * Math.PI * 2) * ry * k, dz)); return pts; };
        this.poly(ring(1.12), 'rgba(214,206,190,1)', pal.ink, 1);
        this.poly(ring(1.0), 'rgba(150,206,236,1)', 'rgba(90,140,170,.5)', 1);
        this.poly(ring(0.6), 'rgba(176,222,244,1)');
        for (let k = 0; k < 2; k++) {
          const r = ((t * 0.35 + k * 0.5) % 1);
          c.globalAlpha = (1 - r) * 0.6;
          this.poly(ring(0.2 + r * 0.6), null, '#ffffff', 1);
          c.globalAlpha = 1;
        }
        for (const [ox, oy, s] of [[-0.5, 0.15, 1], [0.45, -0.2, 0.8], [0.2, 0.35, 0.7]]) {
          const q = P(x + ox, y + oy);
          c.fillStyle = 'rgba(110,180,96,1)';
          c.beginPath(); c.ellipse(q.x, q.y, 9 * s, 4.5 * s, 0, 0.35, Math.PI * 2); c.lineTo(q.x, q.y); c.fill();
        }
        const pink = P(x + 0.45, y - 0.2);
        c.fillStyle = '#ffb3c8'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; c.beginPath(); c.ellipse(pink.x + Math.cos(a) * 2.5, pink.y - 3 + Math.sin(a) * 1.4, 2.4, 1.3, a, 0, Math.PI * 2); c.fill(); }
        // the frog hops between pads now and then
        const hop = (t % 7) < 0.5 ? Math.sin((t % 7) / 0.5 * Math.PI) * 7 : 0;
        const f = P(x - 0.5, y + 0.15);
        c.fillStyle = '#7cc06a'; c.beginPath(); c.ellipse(f.x, f.y - 3 - hop, 4.5, 3.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; for (const ex of [-2, 2]) { c.beginPath(); c.arc(f.x + ex, f.y - 6.5 - hop, 1.5, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#333'; for (const ex of [-2, 2]) { c.beginPath(); c.arc(f.x + ex, f.y - 6.5 - hop, 0.7, 0, Math.PI * 2); c.fill(); }
      }
      if (this.plan.tree) this.treeSkirt(this.plan.tree.x, this.plan.tree.y);

    }

    // One wall of the village: sky that follows the real time of day, rolling
    // hills with little houses and trees, falling snow in winter, a picket
    // fence with bushes in front, and (on the left wall) the flower-arch gate.
    villageWall(len, at, seed, gateY) {
      const c = this.ctx, t = this.t / 1000, pal = this.pal;
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      const night = h < 5 || h >= 19, dawn = h >= 5 && h < 7, dusk = h >= 17 && h < 19;
      const [lo, hi] = night ? [[64, 76, 128], [24, 32, 66]] : dawn ? [[255, 228, 204], [244, 186, 178]] : dusk ? [[255, 206, 168], [196, 150, 204]] : [[226, 244, 252], [146, 204, 242]];
      const quad = (u0, u1, z0, z1, fill, stroke, lw) => this.poly([at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)], fill, stroke, lw);
      const N = 10;
      for (let k = 0; k < N; k++) {
        const m = k / (N - 1), col = lo.map((v, i) => Math.round(v + (hi[i] - v) * m));
        quad(0, len, WALL_H * k / N, WALL_H * (k + 1) / N + 0.01, `rgba(${col},1)`);
      }
      const rnd = (i) => { const v = Math.sin(i * 91.7 + seed * 13.3) * 43758.5453; return v - Math.floor(v); };
      if (night) {
        for (let i = 0; i < len * 2.5; i++) {
          const q = at(rnd(i) * len, 1.2 + rnd(i + 40) * 1.1);
          c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); c.fillStyle = '#fff8d8';
          c.beginPath(); c.arc(q.x, q.y, 0.9 + rnd(i + 9) * 0.8, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
        if (!seed) { const m = at(len * 0.72, 2.0); c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(m.x, m.y, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = `rgba(${hi},1)`; c.beginPath(); c.arc(m.x + 4, m.y - 3, 8, 0, Math.PI * 2); c.fill(); }
      } else {
        if (!seed) {
          const s = at(len * 0.72, 1.95);
          c.fillStyle = 'rgba(255,240,170,.35)'; c.beginPath(); c.arc(s.x, s.y, 20, 0, Math.PI * 2); c.fill();
          c.fillStyle = dawn || dusk ? '#ffb27a' : '#ffe27a'; c.beginPath(); c.arc(s.x, s.y, 11, 0, Math.PI * 2); c.fill();
        }
        for (let i = 0; i < Math.max(2, Math.round(len / 5)); i++) {
          const u = ((t * 0.06 + i * len / Math.max(2, Math.round(len / 5)) + seed) % (len + 2)) - 1;
          if (u < 0.3 || u > len - 0.3) continue;
          const q = at(u, 1.75 + (i % 2) * 0.3);
          c.fillStyle = 'rgba(255,255,255,.92)';
          c.beginPath(); c.ellipse(q.x, q.y, 11, 4.5, 0, 0, Math.PI * 2); c.ellipse(q.x + 6, q.y - 3.5, 7, 5, 0, 0, Math.PI * 2); c.ellipse(q.x - 6, q.y - 2, 5.5, 4, 0, 0, Math.PI * 2); c.fill();
        }
      }
      // hills: far (with little houses) and near (with round trees)
      const hill = (base, a1, a2, ph) => (u) => base + a1 * Math.sin(u * 0.55 + ph) + a2 * Math.sin(u * 1.35 + ph * 2);
      const far = hill(1.5, 0.3, 0.12, seed + 0.4), near = hill(1.08, 0.2, 0.1, seed + 2.1);
      const snow = WINTER;
      const hillPoly = (fz, fill) => {
        const pts = [at(0, 0)];
        for (let u = 0; u <= len + 0.001; u += 0.25) pts.push(at(Math.min(u, len), fz(Math.min(u, len))));
        pts.push(at(len, 0));
        this.poly(pts, fill, 'rgba(107,74,58,.35)', 1);
        if (snow) {
          // a snowy cap along the ridge
          const cap = [];
          for (let u = 0; u <= len + 0.001; u += 0.25) cap.push(at(Math.min(u, len), fz(Math.min(u, len))));
          for (let u = len; u >= -0.001; u -= 0.25) { const uu = Math.max(u, 0); cap.push(at(uu, fz(uu) - 0.1 - 0.05 * Math.sin(uu * 3.1))); }
          this.poly(cap, 'rgba(255,255,255,.95)');
        }
      };
      hillPoly(far, 'rgba(176,216,160,1)');
      const roofs = ['#ef7f6f', '#7fa8e0', '#f2a65a', '#c98fd6'];
      for (let k = 0; k < Math.max(2, Math.round(len / 5)); k++) {
        const u = len * (k + 0.5) / Math.max(2, Math.round(len / 5)) + (rnd(k + 3) - 0.5) * 1.2;
        if (u < 0.6 || u > len - 0.8) continue;
        const z = far(u) - 0.12, w = 0.45;
        this.poly([at(u, z), at(u + w, z), at(u + w, z + 0.28), at(u, z + 0.28)], '#fff6e6', 'rgba(107,74,58,.6)', 0.8);
        this.poly([at(u - 0.06, z + 0.26), at(u + w + 0.06, z + 0.26), at(u + w / 2, z + 0.5)], snow ? '#ffffff' : roofs[(k + seed) % roofs.length], 'rgba(107,74,58,.6)', 0.8);
        const wq = at(u + w * 0.5, z + 0.14);
        c.fillStyle = night ? '#ffd86b' : '#9fc6e8'; c.fillRect(wq.x - 2, wq.y - 2, 4, 4);
        if (night) { c.fillStyle = 'rgba(255,216,107,.3)'; c.beginPath(); c.arc(wq.x, wq.y, 6, 0, Math.PI * 2); c.fill(); }
        if (snow) { for (let i = 0; i < 3; i++) { const q = at(u + w * 0.8, z + 0.55 + ((t * 0.25 + i / 3) % 1) * 0.4); c.globalAlpha = 0.5 * (1 - ((t * 0.25 + i / 3) % 1)); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(q.x, q.y, 2.5, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }
      }
      hillPoly(near, 'rgba(152,204,134,1)');
      for (let k = 0; k < Math.round(len / 3); k++) {
        const u = 0.8 + rnd(k + 20) * (len - 1.6), z = near(u) - 0.05, q = at(u, z), top = at(u, z + 0.32);
        c.fillStyle = '#b8835a'; c.fillRect(q.x - 1, top.y, 2, q.y - top.y);
        c.fillStyle = snow ? '#e7f1ef' : (k % 2 ? 'rgba(108,176,96,1)' : 'rgba(124,190,104,1)');
        c.beginPath(); c.arc(top.x, top.y - 2, 6.5, 0, Math.PI * 2); c.arc(top.x - 4, top.y + 1, 4.5, 0, Math.PI * 2); c.arc(top.x + 4, top.y + 1, 4.5, 0, Math.PI * 2); c.fill();
      }
      if (snow) {
        c.fillStyle = 'rgba(255,255,255,.95)';
        for (let i = 0; i < len * 3; i++) {
          const u = (rnd(i + 70) * len + Math.sin(t * 0.6 + i) * 0.08 + len) % len;
          const z = WALL_H - ((t * 0.1 + rnd(i + 11)) % 1) * WALL_H;
          const q = at(u, z);
          c.beginPath(); c.arc(q.x, q.y, 1.3, 0, Math.PI * 2); c.fill();
        }
      }
      quad(0, len, 0, WALL_H, null, pal.ink, 1.4);
      // bushes behind the fence, then the fence
      for (let i = 0; i < len * 1.4; i++) {
        const u = rnd(i + 200) * len;
        if (gateY != null && Math.abs(u - gateY) < 0.75) continue;
        const q = at(u, 0.22);
        c.fillStyle = i % 2 ? 'rgba(122,186,104,1)' : 'rgba(140,200,118,1)';
        c.beginPath(); c.arc(q.x, q.y, 6 + rnd(i) * 3, 0, Math.PI * 2); c.arc(q.x + 6, q.y + 2, 5, 0, Math.PI * 2); c.fill();
        if (snow) { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(q.x + 1, q.y - 5, 5, 2.2, 0, 0, Math.PI * 2); c.fill(); }
        else if (i % 4 === 0) { c.fillStyle = '#ffc2d3'; c.beginPath(); c.arc(q.x - 2, q.y - 3, 1.6, 0, Math.PI * 2); c.arc(q.x + 4, q.y - 1, 1.6, 0, Math.PI * 2); c.fill(); }
      }
      if (gateY == null) this.fenceRun(at, len, 0.8);
      else {
        this.fenceRun(at, gateY - 0.7, 0.8);
        this.fenceRun((u, z) => at(gateY + 0.7 + u, z), len - gateY - 0.7, 0.8);
        // the gate: two posts and a flower arch, with the clock on top
        for (const g of [gateY - 0.72, gateY + 0.62]) this.poly([at(g, 0), at(g + 0.1, 0), at(g + 0.1, 1.55), at(g, 1.55)], '#c08a5c', pal.ink, 0.9);
        c.lineCap = 'round';
        const arch = (u) => at(u, 1.5 + Math.sin(((u - (gateY - 0.67)) / 1.34) * Math.PI) * 0.32);
        c.strokeStyle = '#c08a5c'; c.lineWidth = 3; c.beginPath();
        for (let u = gateY - 0.67; u <= gateY + 0.67; u += 0.06) { const q = arch(u); u === gateY - 0.67 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y); }
        c.stroke();
        let k = 0;
        for (let u = gateY - 0.72; u <= gateY + 0.72; u += 0.1, k++) {
          const q = arch(Math.min(Math.max(u, gateY - 0.67), gateY + 0.67));
          c.fillStyle = k % 3 === 0 ? '#ff9fb8' : k % 3 === 1 ? '#7cc06a' : '#fff1a8';
          c.beginPath(); c.arc(q.x + (k % 2 ? 1.5 : -1.5), q.y + (k % 2 ? -1 : 1.5), k % 3 === 1 ? 3.2 : 2.4, 0, Math.PI * 2); c.fill();
        }
        this.onWall('x0', gateY, 2.08, (cc) => {
          cc.beginPath(); cc.arc(0, 0, 10, 0, Math.PI * 2); cc.fillStyle = '#fffdf8'; cc.fill();
          cc.lineWidth = 2; cc.strokeStyle = '#c08a5c'; cc.stroke();
          const d = new Date();
          const hand = (ang, l, w) => { cc.beginPath(); cc.moveTo(0, 0); cc.lineTo(Math.sin(ang) * l, -Math.cos(ang) * l); cc.lineWidth = w; cc.strokeStyle = pal.bubbleInk; cc.stroke(); };
          hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, 5, 2);
          hand((d.getMinutes() / 60) * Math.PI * 2, 7.5, 1.4);
        });
        const P = (x, y) => this.iso(x, y, 0);
        this.poly([P(0.05, gateY - 0.6), P(0.9, gateY - 0.6), P(0.9, gateY + 0.6), P(0.05, gateY + 0.6)], 'rgba(222,196,160,1)', 'rgba(150,120,90,.4)');
      }
    }

    // A white picket fence along at(u, z) for u in [0, len].
    fenceRun(at, len, h) {
      if (len <= 0.05) return;
      const ink = this.pal.ink, white = 'rgba(255,251,244,1)';
      for (const z of [h * 0.3, h * 0.68]) this.poly([at(0, z), at(len, z), at(len, z + 0.06), at(0, z + 0.06)], 'rgba(244,234,220,1)', ink, 0.7);
      for (let u = 0.04; u < len - 0.08; u += 0.26) {
        this.poly([at(u, 0), at(u + 0.15, 0), at(u + 0.15, h), at(u + 0.075, h + 0.1), at(u, h)], white, ink, 0.8);
      }
    }

    roundTree(x, y) {
      const c = this.ctx, b = this.iso(x, y, 0);
      this.box(x - 0.08, y - 0.08, 0, 0.16, 0.16, 0.75, '#c99a6e', '#b8835a', '#a5744d');
      const q = this.iso(x, y, 1.35), sway = Math.sin(this.t / 1600 + x) * 1.2;
      const col = WINTER ? ['#9ccc8c', '#b2d9a3'] : ['#7cc06a', '#98d184'];
      c.strokeStyle = this.pal.ink; c.lineWidth = 1;
      for (const [ox, oy, r, k] of [[-11, 4, 12, 0], [11, 4, 12, 0], [0, -6, 15, 1], [-5, 9, 10, 1], [6, 10, 10, 1]]) {
        c.fillStyle = col[k]; c.beginPath(); c.arc(q.x + ox + sway, q.y + oy, r, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.fillStyle = col[1]; for (const [ox, oy, r] of [[-11, 4, 11], [11, 4, 11], [0, -6, 14], [-5, 9, 9], [6, 10, 9]]) { c.beginPath(); c.arc(q.x + ox + sway, q.y + oy, r, 0, Math.PI * 2); c.fill(); }
      if (WINTER) { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(q.x + sway, q.y - 17, 11, 4.5, 0, 0, Math.PI * 2); c.ellipse(q.x - 12 + sway, q.y - 5, 6, 2.5, 0, 0, Math.PI * 2); c.fill(); }
      else { c.fillStyle = '#ef6b5b'; for (const [ox, oy] of [[-8, 2], [7, -4], [2, 10], [-2, -10]]) { c.beginPath(); c.arc(q.x + ox + sway, q.y + oy, 2.3, 0, Math.PI * 2); c.fill(); } }
      if (XMAS) { const cols = ['#ff4d4d', '#ffd23f', '#4db8ff', '#ff7ad9']; for (let i = 0; i < 9; i++) { const a = i * 0.9, on = Math.sin(this.t / 400 + i) > -0.3; c.globalAlpha = on ? 1 : 0.35; c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(q.x + Math.cos(a) * 12 + sway, q.y + Math.sin(a) * 9 + 2, 1.8, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }
      void b;
    }

    mushroom(x, y, col) {
      const c = this.ctx, q = this.iso(x, y, 0);
      c.fillStyle = 'rgba(120,80,60,.14)'; c.beginPath(); c.ellipse(q.x, q.y, 7, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6e8'; c.strokeStyle = this.pal.ink; c.lineWidth = 0.9;
      c.beginPath(); c.roundRect ? c.roundRect(q.x - 3, q.y - 9, 6, 9, 2) : c.rect(q.x - 3, q.y - 9, 6, 9); c.fill(); c.stroke();
      c.fillStyle = col; c.beginPath(); c.ellipse(q.x, q.y - 9, 8.5, 6.5, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffffff'; for (const [ox, oy, r] of [[-4, -11, 1.6], [2, -13, 1.9], [5, -10, 1.2]]) { c.beginPath(); c.arc(q.x + ox, q.y + oy, r, 0, Math.PI * 2); c.fill(); }
      if (WINTER) { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(q.x, q.y - 15, 5, 1.6, 0, 0, Math.PI * 2); c.fill(); }
    }

    // The village job board (along the left side), notices pinned up.
    jobBoard(x, y, len) {
      const c = this.ctx, pal = this.pal;
      const P = (yy, z) => this.iso(x, yy, z);
      for (const ly of [y + 0.1, y + len - 0.18]) this.box(x - 0.04, ly, 0, 0.08, 0.08, 1.0, '#c99a6e', '#b8835a', '#a5744d');
      this.poly([P(y, 0.95), P(y + len, 0.95), P(y + len, 1.85), P(y, 1.85)], 'rgba(222,178,128,1)', '#a8774f', 2);
      this.poly([P(y - 0.08, 1.85), P(y + len + 0.08, 1.85), P(y + len / 2, 2.15)], WINTER ? '#ffffff' : 'rgba(239,127,111,1)', pal.ink, 1);
      const o = this.iso(x, y + len, 0);
      c.save();
      c.translate(o.x, o.y);
      c.transform(1, -0.5, 0, 1, 0, 0);
      const px = (yy) => yy * TW / 2, pz = (z) => -z * TH; // yy measured from the near end
      c.fillStyle = '#6b4a3a'; c.font = '800 7px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('구인 게시판', px(len / 2), pz(1.73));
      const notes = [['#fffdf5', '풀뽑기'], ['#ffe0ea', '배달'], ['#e3f1ff', '청소'], ['#fff1c2', '토벌']];
      notes.forEach(([bg, txt], i) => {
        const nx = px(0.12 + (i % 2) * len * 0.45), nz = pz(1.58 - Math.floor(i / 2) * 0.33);
        c.fillStyle = bg; c.fillRect(nx, nz, len * TW / 2 * 0.4, 9);
        c.strokeStyle = 'rgba(107,74,58,.4)'; c.lineWidth = 0.6; c.strokeRect(nx, nz, len * TW / 2 * 0.4, 9);
        c.fillStyle = '#e8413a'; c.beginPath(); c.arc(nx + len * TW / 2 * 0.2, nz + 1, 1.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#6b4a3a'; c.font = '700 5.5px ui-sans-serif, system-ui, sans-serif'; c.fillText(txt, nx + len * TW / 2 * 0.2, nz + 5.3);
      });
      c.restore();
    }

    // Christmas on the walls: a fluffy garland with red bows along the top of
    // both walls, big glowing bulbs on it, wreaths, and a MERRY XMAS banner.
    xmasWalls() {
      const { W, D, windows } = this.plan;
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      // In the village the garland drapes along the fence instead of the ceiling;
      // in the paper office everything takes the milk-tea palette and a pen line.
      const VIL = this.pal.cute, PAPER = !!this.plan.paper, TOP = PAPER ? this.plan.WH + 0.12 : VIL ? 1.0 : WALL_H, SAG = VIL ? 0.1 : 0.2;
      const cols = PAPER ? ['#e8504a', '#f2c230', '#5aa86a', '#5b8fc9', '#e8504a', '#fff8ea'] : ['#ff4d4d', '#ffd23f', '#4db8ff', '#5ee07a', '#ff7ad9', '#b48cff'];
      const G1 = PAPER ? '#4b8a57' : '#3e9a55', G2 = PAPER ? '#67a66d' : '#5bb86d', BOW = PAPER ? '#d64541' : '#e8413a', KNOT = PAPER ? '#f2c230' : '#ffd23f';
      const pen = 'rgba(112,88,74,.7)';
      const run = (len, at, seed) => {
        const pts = [];
        for (let u = 0.15; u <= len - 0.1; u += 0.12) pts.push([u, TOP - 0.18 - Math.sin(((u - 0.15) % 1.2) / 1.2 * Math.PI) * SAG]);
        // fluffy green garland
        for (const [u, z] of pts) {
          const q = at(u, z);
          c.fillStyle = G1; c.beginPath(); c.arc(q.x, q.y, 3.4, 0, Math.PI * 2); c.fill();
          c.fillStyle = G2; c.beginPath(); c.arc(q.x - 1, q.y - 1.2, 2, 0, Math.PI * 2); c.fill();
        }
        // red bows where the garland is pinned up
        for (let u = 0.15; u <= len - 0.1; u += 1.2) {
          const q = at(u, TOP - 0.16);
          c.fillStyle = BOW;
          c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - 5, q.y - 3); c.lineTo(q.x - 5, q.y + 3); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + 5, q.y - 3); c.lineTo(q.x + 5, q.y + 3); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(q.x - 1, q.y); c.lineTo(q.x - 3, q.y + 7); c.lineTo(q.x + 1, q.y + 6); c.fill();
          c.fillStyle = KNOT; c.beginPath(); c.arc(q.x, q.y, 1.5, 0, Math.PI * 2); c.fill();
          if (PAPER) { c.strokeStyle = pen; c.lineWidth = 0.6; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - 5, q.y - 3); c.lineTo(q.x - 5, q.y + 3); c.closePath(); c.moveTo(q.x, q.y); c.lineTo(q.x + 5, q.y - 3); c.lineTo(q.x + 5, q.y + 3); c.closePath(); c.stroke(); }
        }
        // big glowing bulbs
        pts.forEach(([u, z], i) => {
          if (i % 2) return;
          const q = at(u, z - 0.06);
          const col = cols[(i / 2 + seed) % cols.length];
          const on = Math.sin(t * 2.6 + i * 0.7) > -0.35;
          if (on) { c.globalAlpha = 0.3; c.fillStyle = col; c.beginPath(); c.arc(q.x, q.y + 2, 6, 0, Math.PI * 2); c.fill(); }
          c.globalAlpha = on ? 1 : 0.35;
          c.fillStyle = col; c.beginPath(); c.ellipse(q.x, q.y + 2, 2.1, 2.9, 0, 0, Math.PI * 2); c.fill();
          if (PAPER) { c.strokeStyle = pen; c.lineWidth = 0.6; c.stroke(); }
          c.globalAlpha = 1;
        });
      };
      run(W, (u, z) => P(u, 0, z), 0);
      run(D, (u, z) => P(0, u, z), 3);
      // wreaths: on the door, between the windows, and on the left wall
      const wreath = (dir, a, z, r) => this.onWall(dir, a, z, (cc) => {
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * Math.PI * 2;
          cc.fillStyle = PAPER ? (k % 2 ? '#3f7d4c' : '#5d9e66') : (k % 2 ? '#2f8a45' : '#4fb565');
          cc.beginPath(); cc.arc(Math.cos(ang) * r, Math.sin(ang) * r, r * 0.45, 0, Math.PI * 2); cc.fill();
        }
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2 + 0.3;
          cc.fillStyle = cols[k % cols.length];
          cc.beginPath(); cc.arc(Math.cos(ang) * r, Math.sin(ang) * r, r * 0.2, 0, Math.PI * 2); cc.fill();
        }
        if (PAPER) {
          // pen outline inside and out, then cream berries' shine
          cc.strokeStyle = pen; cc.lineWidth = 0.8;
          cc.beginPath(); cc.arc(0, 0, r * 1.45, 0, Math.PI * 2); cc.stroke();
          cc.beginPath(); cc.arc(0, 0, r * 0.55, 0, Math.PI * 2); cc.stroke();
        }
        cc.fillStyle = BOW;
        cc.beginPath(); cc.moveTo(0, r); cc.lineTo(-r * 0.7, r * 0.5); cc.lineTo(-r * 0.7, r * 1.4); cc.closePath(); cc.fill();
        cc.beginPath(); cc.moveTo(0, r); cc.lineTo(r * 0.7, r * 0.5); cc.lineTo(r * 0.7, r * 1.4); cc.closePath(); cc.fill();
        if (PAPER) {
          cc.strokeStyle = pen; cc.lineWidth = 0.7;
          cc.beginPath(); cc.moveTo(0, r); cc.lineTo(-r * 0.7, r * 0.5); cc.lineTo(-r * 0.7, r * 1.4); cc.closePath(); cc.moveTo(0, r); cc.lineTo(r * 0.7, r * 0.5); cc.lineTo(r * 0.7, r * 1.4); cc.closePath(); cc.stroke();
          cc.fillStyle = KNOT; cc.beginPath(); cc.arc(0, r, r * 0.18, 0, Math.PI * 2); cc.fill();
        }
      });
      wreath('x0', this.plan.door.y, PAPER ? 1.6 : VIL ? 1.25 : 1.3, 7);
      for (let k = 0; k < windows.length - 1; k++) wreath('y0', windows[k] + 1.95, VIL ? 0.5 : 1.45, 6);
      wreath('x0', PAPER ? 3.2 : 3.5, PAPER ? 0.8 : VIL ? 0.5 : 1.5, 7);
      if (PAPER) for (const u of [4.45, 9.2]) wreath('y0', u, 0.85, 6.5); // between the framed paintings
      this.xmasBunting();
    }

    xmasBunting() {
      const PAPER = !!this.plan.paper, VIL = this.pal.cute;
      const pen = 'rgba(112,88,74,.7)';
      const cols = PAPER ? ['#d64541', '#f2c230', '#3d7d4b', '#d64541', '#e9b53b', '#3d7d4b'] : ['#ff4d4d', '#ffd23f', '#4db8ff', '#5ee07a', '#ff7ad9', '#b48cff'];
      // MERRY XMAS banner of little flags on the left wall
      const word = 'MERRY XMAS';
      const y0 = 5.6, step = 0.32;
      for (let k = 0; k < word.length; k++) {
        if (word[k] === ' ') continue;
        const yy = y0 + k * step, zz = (PAPER ? 1.0 : VIL ? 1.3 : 1.9) - Math.sin((k / (word.length - 1)) * Math.PI) * 0.15;
        this.onWall('x0', yy, zz, (cc) => {
          cc.fillStyle = cols[k % cols.length];
          cc.beginPath(); cc.moveTo(-5, -5); cc.lineTo(5, -5); cc.lineTo(0, 6); cc.closePath(); cc.fill();
          if (PAPER) { cc.strokeStyle = pen; cc.lineWidth = 0.6; cc.stroke(); }
          cc.fillStyle = '#fff'; cc.font = '800 6px ui-sans-serif, system-ui, sans-serif'; cc.textAlign = 'center'; cc.textBaseline = 'middle';
          cc.fillText(word[k], 0, -1.5);
        });
      }
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
      if (XMAS) {
        // poinsettia: red star bracts with a gold middle
        for (const [ox, oy] of [[0, -24], [-7, -17], [7, -18]]) {
          c.fillStyle = this.plan && this.plan.paper ? '#d64541' : '#e02b3a';
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + sway;
            c.beginPath(); c.ellipse(b.x + ox + Math.cos(a) * 3.5, b.y + oy + Math.sin(a) * 2.2, 3.6, 1.6, a, 0, Math.PI * 2); c.fill();
          }
          c.fillStyle = this.plan && this.plan.paper ? '#f2c230' : '#ffd34d'; c.beginPath(); c.arc(b.x + ox, b.y + oy, 1.4, 0, Math.PI * 2); c.fill();
        }
      }
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
      const paper = this.plan && this.plan.paper;
      for (const [lx, ly] of [[0.1, 0.1], [2.4, 0.1], [0.1, 1.2], [2.4, 1.2]]) this.box(x + lx, y + ly, 0, 0.08, 0.08, 0.7, paper ? '#c9b396' : '#333', paper ? '#c9b396' : '#333', paper ? '#b8a284' : '#222');
      if (paper) this.box(x, y, 0.7, 2.6, 1.4, 0.06, '#9fb8a8', '#87a191', '#77917f');
      else this.box(x, y, 0.7, 2.6, 1.4, 0.06, '#2f7a52', '#245f40', '#1d4f35');
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
      const PA = this.plan && this.plan.paper;
      if (PA) this.box(x, y, 0.9, 0.5, 0.45, 0.6, '#b9aca2', '#a3958a', '#8c7a6e');
      else this.box(x, y, 0.9, 0.5, 0.45, 0.6, '#555b63', '#3a3f45', '#2e3237');
      this.box(x + 0.15, y + 0.42, 1.0, 0.2, 0.05, 0.15, PA ? '#70584a' : '#222', PA ? '#5e4a3e' : '#111', PA ? '#5e4a3e' : '#111');
      const p = this.iso(x + 0.4, y + 0.45, 1.35);
      this.ctx.fillStyle = Math.sin(this.t / 400) > 0 ? (PA ? '#e38f80' : '#ff6b4a') : (PA ? '#b9aca2' : '#7a3a2a');
      this.ctx.fillRect(p.x, p.y, 2.5, 2.5);
      this.box(x + 0.6, y + 0.1, 0.9, 0.14, 0.14, 0.14, '#fff', '#ddd', '#ccc');
    }

    sink(x, y) {
      const PA = this.plan && this.plan.paper;
      this.box(x, y + 0.05, 0.9, 0.55, 0.4, 0.02, PA ? '#d8cfc4' : '#9aa3ad', PA ? '#c9bcb0' : '#7d858e', PA ? '#b9aca2' : '#6c737b');
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
      const PA = this.plan && this.plan.paper;
      if (PA) this.box(x, y, 0, 0.42, 0.42, 0.95, '#faf6ed', '#e8d8c3', '#d8c4ab');
      else this.box(x, y, 0, 0.42, 0.42, 0.95, '#e8ecef', '#cfd5db', '#bcc3ca');
      const c = this.ctx;
      const p = this.iso(x + 0.21, y + 0.21, 0.95);
      c.fillStyle = PA ? 'rgba(184,205,222,.65)' : 'rgba(120,180,240,.6)';
      c.beginPath(); c.ellipse(p.x, p.y - 9, 8, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(p.x - 4, p.y - 16, 2, 10);
      const k = (this.t / 1800) % 1;
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(p.x + 2, p.y - 2 - k * 16, 1.2, 0, Math.PI * 2); c.fill();
      const tap = this.iso(x + 0.21, y + 0.42, 0.65);
      c.fillStyle = PA ? '#e38f80' : '#3b8ee0'; c.fillRect(tap.x - 1.5, tap.y, 3, 3);
    }

    couch(x, y) {
      const pal = this.pal;
      this.box(x, y - 0.05, 0.32, 2.8, 0.25, 0.42, this.shade(pal.couch, 10), pal.couchD, this.shade(pal.couchD, -12));
      this.box(x, y, 0, 2.8, 0.8, 0.32, pal.couch, pal.couchD, this.shade(pal.couchD, -12));
      this.box(x - 0.15, y - 0.05, 0, 0.18, 0.85, 0.52, this.shade(pal.couch, 6), pal.couchD, this.shade(pal.couchD, -12));
      this.box(x + 2.8, y - 0.05, 0, 0.18, 0.85, 0.52, this.shade(pal.couch, 6), pal.couchD, this.shade(pal.couchD, -12));
      this.box(x + 2.15, y + 0.12, 0.32, 0.35, 0.16, 0.28, '#ecc768', '#ddb658', '#cba549');
    }

    coffeeTable(x, y) {
      const pal = this.pal;
      this.box(x, y, 0, 1.6, 0.7, 0.3, this.shade(pal.deskTop, -10), pal.deskL, pal.deskR);
      if (this.plan && this.plan.paper) this.box(x + 0.2, y + 0.15, 0.3, 0.35, 0.25, 0.06, '#e38f80', '#d47c6e', '#c46e60');
      else this.box(x + 0.2, y + 0.15, 0.3, 0.35, 0.25, 0.06, '#c96442', '#a85336', '#8f462e');
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
      const paper = this.plan && this.plan.paper, alt = paper && x % 2 > 1;
      if (paper) this.box(x, y, 0, 0.7, 0.7, 1.75, alt ? '#d9cfe0' : '#b8c7b0', alt ? '#c9bcd6' : '#a3b69b', alt ? '#b8aac8' : '#93a68b');
      else this.box(x, y, 0, 0.7, 0.7, 1.75, '#3a2a6a', '#2b1f52', '#221843');
      const P = (a, b, c) => this.iso(a, b, c);
      const hue = (this.t / 20) % 360;
      this.poly([P(x + 0.1, y + 0.7, 1.0), P(x + 0.6, y + 0.7, 1.0), P(x + 0.6, y + 0.7, 1.45), P(x + 0.1, y + 0.7, 1.45)], (paper ? `hsl(${hue},45%,78%)` : `hsl(${hue},70%,55%)`));
      const blip = this.iso(x + 0.25 + 0.2 * Math.sin(this.t / 300), y + 0.7, 1.2);
      this.ctx.fillStyle = '#fff'; this.ctx.fillRect(blip.x, blip.y, 3, 3);
      this.poly([P(x, y + 0.7, 1.55), P(x + 0.7, y + 0.7, 1.55), P(x + 0.7, y + 0.7, 1.72), P(x, y + 0.7, 1.72)], paper ? '#ecc768' : '#ffcf4a');
      if (paper) this.box(x, y + 0.7, 0.8, 0.7, 0.2, 0.08, '#faf6ed', '#e8d8c3', '#d8c4ab');
      else this.box(x, y + 0.7, 0.8, 0.7, 0.2, 0.08, '#4a3a8a', '#3a2a6a', '#2b1f52');
      const j = this.iso(x + 0.25, y + 0.8, 0.88);
      this.ctx.fillStyle = paper ? '#e38f80' : '#e04a4a'; this.ctx.beginPath(); this.ctx.arc(j.x, j.y - 3, 2.5, 0, Math.PI * 2); this.ctx.fill();
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
      const paper = this.plan && this.plan.paper;
      const leg = paper ? '#c9b396' : '#5a4030';
      for (const [lx, ly] of [[0.1, 0.1], [1.42, 0.1], [0.1, 0.62], [1.42, 0.62]]) this.box(x + lx, y + ly, 0, 0.08, 0.08, 0.6, leg, leg, leg);
      if (paper) this.box(x, y, 0.6, 1.6, 0.8, 0.25, '#a9c3a0', '#e9b8aa', '#d9a596');
      else this.box(x, y, 0.6, 1.6, 0.8, 0.25, '#2f8a4a', '#6e533b', '#5c4431');
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
          this.ctx.fillStyle = paper ? (k % 2 ? '#e38f80' : '#9a8fc0') : (k % 2 ? '#c0392b' : '#2f6fb0');
          this.ctx.fillRect(q.x - 1.5, q.y - 3, 3, 6);
        }
      }
    }

    // Bungeoppang stall: an orange cart with big blue wheels, a glass case of
    // fish breads, a picture signboard, the iron mold, and a red-and-yellow
    // striped canopy on four thin poles, all one piece.
    pojangmacha(add, x, y) {
      const W = 1.5, D = 0.75;
      add(x + W / 2 + y + D / 2, () => this.bungeoCart(x, y));
      // The canopy is drawn after the baker behind the cart, before customers in front.
      add(x + y + 1.45, () => this.stallCanopy(x, y, W, D));
    }

    stallCanopy(x, y, W, D) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const H = 1.95, x0 = x - 0.12, x1 = x + W + 0.12, y0 = y - 0.12, y1 = y + D + 0.12;
      const PA = this.plan && this.plan.paper;
      const RED = PA ? '#e38f80' : '#e8413a', YEL = PA ? '#faf6ed' : '#ffd23f';
      const ink = this.pal.ink || '#5b4032';
      const raw = (pts, fill) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fillStyle = fill; c.fill(); };
      // poles at the cart corners
      for (const [px, py] of [[x + 0.03, y + 0.03], [x + W - 0.06, y + 0.03], [x + 0.03, y + D - 0.06], [x + W - 0.06, y + D - 0.06]]) {
        this.box(px, py, 0.8, 0.03, 0.03, H - 0.8, PA ? '#d8c4ab' : '#c9c9c9', PA ? '#c9b396' : '#b0b0b0', PA ? '#b8a284' : '#999');
      }
      // warm bulb under the canopy
      const bulb = P(x + W * 0.35, y + D / 2, H - 0.25);
      const g = c.createRadialGradient(bulb.x, bulb.y, 0, bulb.x, bulb.y, 26);
      g.addColorStop(0, 'rgba(255,220,130,.55)'); g.addColorStop(1, 'rgba(255,220,130,0)');
      c.fillStyle = g; c.beginPath(); c.arc(bulb.x, bulb.y, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(bulb.x, bulb.y, 2.6, 0, Math.PI * 2); c.fill();
      // striped roof (stripes run front to back, like the real ones)
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n;
        raw([P(a, y0, H), P(b, y0, H), P(b, y1, H), P(a, y1, H)], i % 2 ? YEL : RED);
      }
      c.strokeStyle = ink; c.lineWidth = 0.9;
      c.beginPath(); [P(x0, y0, H), P(x1, y0, H), P(x1, y1, H), P(x0, y1, H)].forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.stroke();
      // scalloped valance hanging on the front and right edges, same stripes
      const drop = 0.2, sway = Math.sin(t * 1.8) * 0.01;
      const valance = (ax, ay, bx, by, segs) => {
        for (let i = 0; i < segs; i++) {
          const k0 = i / segs, k1 = (i + 1) / segs;
          const p0 = P(ax + (bx - ax) * k0, ay + (by - ay) * k0, H), p1 = P(ax + (bx - ax) * k1, ay + (by - ay) * k1, H);
          const q0 = P(ax + (bx - ax) * k0, ay + (by - ay) * k0, H - drop - sway), q1 = P(ax + (bx - ax) * k1, ay + (by - ay) * k1, H - drop - sway);
          c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(q1.x, q1.y);
          c.quadraticCurveTo((q0.x + q1.x) / 2, (q0.y + q1.y) / 2 + 3.5, q0.x, q0.y); c.closePath();
          c.fillStyle = i % 2 ? YEL : RED; c.fill();
          c.strokeStyle = ink; c.lineWidth = 0.6; c.stroke();
        }
      };
      valance(x0, y1, x1, y1, n);
      valance(x1, y0, x1, y1, 4);
    }

    // The big Christmas tree in the middle of the office: a warm glow, hundreds
    // of twinkling fairy lights, red and gold baubles, red ribbon bows, gold
    // tinsel, a glittering red star, and presents all around.
    xmasTree(x, y) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const ink = this.pal.ink || '#2f4a34';
      const rnd = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      const gift = (gx, gy, s, col, rib) => {
        const h = s * 0.8;
        this.box(gx, gy, 0, s, s, h, this.shade(col, 18), col, this.shade(col, -18));
        c.strokeStyle = rib; c.lineWidth = 1.8;
        const a0 = P(gx + s / 2, gy, h), a1 = P(gx + s / 2, gy + s, h), a2 = P(gx + s / 2, gy + s, 0);
        c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.lineTo(a2.x, a2.y); c.stroke();
        const b0 = P(gx, gy + s / 2, h), b1 = P(gx + s, gy + s / 2, h), b2 = P(gx + s, gy + s / 2, 0);
        c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.lineTo(b2.x, b2.y); c.stroke();
        const top = P(gx + s / 2, gy + s / 2, h);
        c.fillStyle = rib; c.beginPath(); c.ellipse(top.x - 3, top.y - 1.8, 3.2, 2, -0.5, 0, Math.PI * 2); c.ellipse(top.x + 3, top.y - 1.8, 3.2, 2, 0.5, 0, Math.PI * 2); c.fill();
      };
      const base = P(x, y, 0.42);
      const tiers = [[86, 46, 0], [74, 42, 30], [62, 38, 58], [50, 34, 84], [38, 30, 106], [26, 26, 126]];
      const TOP = 126 + 26 + 14;
      // warm glow around the whole tree
      const gl = c.createRadialGradient(base.x, base.y - 80, 10, base.x, base.y - 80, 140);
      gl.addColorStop(0, 'rgba(255,214,120,.38)'); gl.addColorStop(1, 'rgba(255,214,120,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(base.x, base.y - 80, 140, 0, Math.PI * 2); c.fill();
      // presents behind
      gift(x - 1.0, y - 0.7, 0.46, '#7d5be0', '#ffd34d');
      gift(x + 0.3, y - 1.0, 0.4, '#2fa36b', '#e8413a');
      gift(x - 0.3, y - 1.05, 0.34, '#e05ab4', '#ffffff');
      // pot + trunk
      this.box(x - 0.3, y - 0.3, 0, 0.6, 0.6, 0.32, '#e8413a', '#c9302a', '#b02822');
      this.box(x - 0.1, y - 0.1, 0.32, 0.2, 0.2, 0.15, '#8a5a3a', '#7a4a2e', '#6a3e26');
      // branches
      const tri = [];
      for (const [hw, h, up] of tiers) {
        const bx = base.x, by = base.y - up;
        tri.push({ bx, by, hw, top: by - h - 14 });
        c.fillStyle = '#2f8a4a';
        c.beginPath();
        c.moveTo(bx - hw, by);
        for (let k = 0; k <= 8; k++) { const px = bx - hw + (2 * hw) * k / 8; c.quadraticCurveTo(px - hw / 8, by + 8, px, by); }
        c.lineTo(bx, by - h - 14);
        c.closePath(); c.fill();
        c.strokeStyle = ink; c.lineWidth = 1.3; c.stroke();
        c.fillStyle = 'rgba(140,220,140,.3)';
        c.beginPath(); c.moveTo(bx - hw * 0.85, by - 2); c.lineTo(bx - 3, by - h - 8); c.lineTo(bx - hw * 0.3, by - 2); c.closePath(); c.fill();
      }
      // a point inside tier i, at f across (0..1) and g up (0..1)
      const at = (i, f, g) => { const q = tri[i]; const w = q.hw * (1 - g) * 0.92; return { x: q.bx - w + 2 * w * f, y: q.by - 4 - (q.by - q.top) * g * 0.85 }; };
      // gold tinsel swags
      c.strokeStyle = '#ffcf3f'; c.lineWidth = 2;
      for (let i = 0; i < tri.length - 1; i++) {
        const a = at(i, 0.05, 0.35), b = at(i, 0.95, 0.55), m = at(i, 0.5, 0.15);
        c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(m.x, m.y + 8, b.x, b.y); c.stroke();
      }
      // fairy lights: lots of tiny warm twinkles all over
      let n = 0;
      for (let i = 0; i < tri.length; i++) {
        const count = 34 - i * 4;
        for (let k = 0; k < count; k++, n++) {
          const q = at(i, rnd(n), rnd(n + 999) * 0.9);
          const tw = 0.5 + 0.5 * Math.sin(t * (2 + rnd(n + 7) * 3) + n);
          c.globalAlpha = 0.25 + 0.5 * tw;
          c.fillStyle = '#fff2b0'; c.beginPath(); c.arc(q.x, q.y, 3.2, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.6 + 0.4 * tw;
          c.fillStyle = '#fffbe6'; c.beginPath(); c.arc(q.x, q.y, 1.2, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
      // baubles: red, gold, burgundy, with a shine
      const bcol = ['#e8413a', '#f2c14e', '#9c1f3a', '#e8413a', '#ffd34d', '#c0c6cf'];
      n = 0;
      for (let i = 0; i < tri.length; i++) {
        const count = 7 - Math.floor(i / 1.5);
        for (let k = 0; k < count; k++, n++) {
          const q = at(i, (k + 0.5) / count + (rnd(n + 50) - 0.5) * 0.08, 0.1 + rnd(n + 77) * 0.35);
          const r = 4.2 - i * 0.3;
          c.fillStyle = bcol[n % bcol.length];
          c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 0.6; c.stroke();
          c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(q.x - r * 0.35, q.y - r * 0.35, r * 0.3, 0, Math.PI * 2); c.fill();
        }
      }
      // red ribbon bows with long tails
      const bow = (q, s) => {
        c.fillStyle = '#d42a2a'; c.strokeStyle = '#8f1515'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(q.x, q.y); c.bezierCurveTo(q.x - 9 * s, q.y - 7 * s, q.x - 10 * s, q.y + 4 * s, q.x, q.y); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(q.x, q.y); c.bezierCurveTo(q.x + 9 * s, q.y - 7 * s, q.x + 10 * s, q.y + 4 * s, q.x, q.y); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(q.x - 1, q.y); c.lineTo(q.x - 5 * s, q.y + 12 * s); c.lineTo(q.x - 2 * s, q.y + 11 * s); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(q.x + 1, q.y); c.lineTo(q.x + 5 * s, q.y + 12 * s); c.lineTo(q.x + 2 * s, q.y + 11 * s); c.closePath(); c.fill();
        c.fillStyle = '#b81f1f'; c.beginPath(); c.arc(q.x, q.y, 2 * s, 0, Math.PI * 2); c.fill();
      };
      [[0, 0.25, 0.3], [0, 0.75, 0.25], [1, 0.5, 0.4], [2, 0.2, 0.3], [2, 0.8, 0.35], [3, 0.5, 0.3], [4, 0.3, 0.3], [4, 0.75, 0.3]]
        .forEach(([i, f, g], k) => bow(at(i, f, g), 1.1 - i * 0.08));
      // glittering red star
      const sx = base.x, sy = base.y - TOP - 6, r = 13 + Math.sin(t * 2) * 1;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 34);
      sg.addColorStop(0, 'rgba(255,200,120,.75)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e32b2b'; c.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.strokeStyle = '#ffd34d'; c.lineWidth = 1.2; c.stroke();
      for (let k = 0; k < 5; k++) {
        const a = t * 1.5 + k * 1.26, rr = r * 0.5;
        c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 1, 0, Math.PI * 2); c.fill();
      }
      // presents in front
      gift(x + 0.45, y + 0.35, 0.48, '#e8413a', '#ffffff');
      gift(x - 0.6, y + 0.45, 0.42, '#3b8ee0', '#ffd34d');
      gift(x - 0.05, y + 0.75, 0.34, '#ffd34d', '#e8413a');
      gift(x + 0.95, y - 0.2, 0.36, '#ffffff', '#e8413a');
      gift(x - 1.1, y + 0.05, 0.32, '#2fa36b', '#ffd34d');
    }

    // Christmas tree in the milk-tea paper style: soft sage tiers in brown pen
    // with watercolour blooms, cream bead garlands, coral/mustard/lavender
    // baubles, little coral bows, warm fairy lights and a paper star.
    paperTree(x, y) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const pen = 'rgba(112,88,74,.8)';
      const rnd = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      const gift = (gx, gy, s, col, rib) => {
        const h = s * 0.8;
        this.box(gx, gy, 0, s, s, h, this.shade(col, 14), col, this.shade(col, -14));
        c.strokeStyle = rib; c.lineWidth = 1.6;
        const a0 = P(gx + s / 2, gy, h), a1 = P(gx + s / 2, gy + s, h), a2 = P(gx + s / 2, gy + s, 0);
        c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.lineTo(a2.x, a2.y); c.stroke();
        const b0 = P(gx, gy + s / 2, h), b1 = P(gx + s, gy + s / 2, h), b2 = P(gx + s, gy + s / 2, 0);
        c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.lineTo(b2.x, b2.y); c.stroke();
        const top = P(gx + s / 2, gy + s / 2, h);
        c.fillStyle = rib; c.beginPath(); c.ellipse(top.x - 3, top.y - 1.8, 3.2, 2, -0.5, 0, Math.PI * 2); c.ellipse(top.x + 3, top.y - 1.8, 3.2, 2, 0.5, 0, Math.PI * 2); c.fill();
      };
      const base = P(x, y, 0.4);
      // soft warm halo
      const gl = c.createRadialGradient(base.x, base.y - 85, 10, base.x, base.y - 85, 130);
      gl.addColorStop(0, 'rgba(255,214,120,.38)'); gl.addColorStop(1, 'rgba(255,226,160,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(base.x, base.y - 85, 130, 0, Math.PI * 2); c.fill();
      gift(x - 1.0, y - 0.7, 0.46, 'rgba(91,143,201,1)', '#f2c230');
      gift(x + 0.3, y - 1.0, 0.4, 'rgba(79,143,90,1)', '#d64541');
      // woven basket pot + trunk
      this.box(x - 0.32, y - 0.32, 0, 0.64, 0.64, 0.34, '#e8d8c3', '#d8bd98', '#c9a983');
      const bq = P(x, y + 0.32, 0.17);
      c.strokeStyle = 'rgba(112,88,74,.35)'; c.lineWidth = 0.8;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(bq.x + k * 6 - 3, bq.y - 6 + k * 3); c.lineTo(bq.x + k * 6 + 3, bq.y + 4 + k * 3); c.stroke(); }
      this.box(x - 0.09, y - 0.09, 0.34, 0.18, 0.18, 0.14, '#b08a68', '#9c7656', '#8a6648');
      // tiers: two sage greens, scalloped hems, pen outline, watercolour blooms
      const tiers = [[84, 46, 0], [72, 42, 30], [60, 38, 58], [48, 34, 84], [37, 30, 106], [26, 26, 126]];
      const tri = [];
      tiers.forEach(([hw, h, up], i) => {
        const bx = base.x, by = base.y - up, top = by - h - 14;
        tri.push({ bx, by, hw, top });
        c.fillStyle = i % 2 ? '#5d9e66' : '#4b8a57';
        c.beginPath(); c.moveTo(bx - hw, by);
        for (let k = 0; k <= 9; k++) { const px = bx - hw + (2 * hw) * k / 9; c.quadraticCurveTo(px - hw / 9, by + 7, px, by); }
        c.lineTo(bx + 1.5, top + 2); c.quadraticCurveTo(bx, top - 1, bx - 1.5, top + 2); c.closePath(); c.fill();
        c.strokeStyle = pen; c.lineWidth = 1.2; c.stroke();
        // watercolour bloom: lighter patch on the left, a darker pool on the right
        c.fillStyle = 'rgba(170,215,160,.42)';
        c.beginPath(); c.ellipse(bx - hw * 0.35, by - h * 0.35, hw * 0.28, h * 0.32, -0.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(30,80,40,.2)';
        c.beginPath(); c.ellipse(bx + hw * 0.4, by - 6, hw * 0.3, 7, 0, 0, Math.PI * 2); c.fill();
        // a few pen-drawn needle ticks
        c.strokeStyle = 'rgba(30,70,40,.45)'; c.lineWidth = 0.8;
        for (let k = 0; k < 5; k++) { const fx = bx - hw * 0.7 + rnd(i * 10 + k) * hw * 1.4, fy = by - 4 - rnd(i * 10 + k + 5) * h * 0.6; c.beginPath(); c.moveTo(fx - 2, fy - 2); c.lineTo(fx, fy); c.lineTo(fx + 2, fy - 2); c.stroke(); }
      });
      const at = (i, f, g) => { const q = tri[i]; const w = q.hw * (1 - g) * 0.9; return { x: q.bx - w + 2 * w * f, y: q.by - 4 - (q.by - q.top) * g * 0.85 }; };
      // cream bead garlands
      for (let i = 0; i < tri.length - 1; i++) {
        const a = at(i, 0.04, 0.32), b = at(i, 0.96, 0.52), m = at(i, 0.5, 0.12);
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, qx = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * m.x + u * u * b.x, qy = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * (m.y + 8) + u * u * b.y;
          c.fillStyle = k % 3 ? '#f2c230' : '#fff8ea'; c.beginPath(); c.arc(qx, qy, 1.8, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(112,88,74,.35)'; c.lineWidth = 0.5; c.stroke();
        }
      }
      // warm fairy lights
      let n = 0;
      for (let i = 0; i < tri.length; i++) {
        for (let k = 0; k < 22 - i * 3; k++, n++) {
          const q = at(i, rnd(n), rnd(n + 999) * 0.9);
          const tw = 0.5 + 0.5 * Math.sin(t * (1.8 + rnd(n + 7) * 2.5) + n);
          c.globalAlpha = 0.3 + 0.55 * tw; c.fillStyle = '#ffd970'; c.beginPath(); c.arc(q.x, q.y, 3, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.75 + 0.25 * tw; c.fillStyle = '#fffdf2'; c.beginPath(); c.arc(q.x, q.y, 1.1, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
      // baubles in the palette, pen-outlined, with a paper shine
      const bcol = ['#d64541', '#f2c230', '#fff8ea', '#d64541', '#5b8fc9', '#f2c230', '#b8323a'];
      n = 0;
      for (let i = 0; i < tri.length; i++) {
        const count = 6 - Math.floor(i / 1.5);
        for (let k = 0; k < count; k++, n++) {
          const q = at(i, (k + 0.5) / count + (rnd(n + 50) - 0.5) * 0.08, 0.1 + rnd(n + 77) * 0.35);
          const r = 4.4 - i * 0.3;
          c.fillStyle = bcol[n % bcol.length]; c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
          c.strokeStyle = pen; c.lineWidth = 0.8; c.stroke();
          c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(q.x - r * 0.35, q.y - r * 0.4, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2); c.fill();
        }
      }
      // small coral bows
      const bow = (q, s) => {
        c.fillStyle = '#d64541'; c.strokeStyle = pen; c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(q.x, q.y); c.bezierCurveTo(q.x - 8 * s, q.y - 6 * s, q.x - 9 * s, q.y + 4 * s, q.x, q.y); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(q.x, q.y); c.bezierCurveTo(q.x + 8 * s, q.y - 6 * s, q.x + 9 * s, q.y + 4 * s, q.x, q.y); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(q.x - 1, q.y); c.lineTo(q.x - 4 * s, q.y + 9 * s); c.moveTo(q.x + 1, q.y); c.lineTo(q.x + 4 * s, q.y + 9 * s); c.strokeStyle = '#d64541'; c.lineWidth = 1.6; c.stroke();
      };
      [[0, 0.22, 0.3], [0, 0.78, 0.25], [1, 0.5, 0.42], [2, 0.2, 0.3], [2, 0.8, 0.35], [3, 0.5, 0.32], [4, 0.3, 0.3]].forEach(([i, f, g]) => bow(at(i, f, g), 1 - i * 0.08));
      // paper star: mustard, pen outline, a soft glow and slow twinkle
      const TOP = 126 + 26 + 14, sx = base.x, sy = base.y - TOP - 6, r = 13 + Math.sin(t * 1.6) * 0.8;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 28);
      sg.addColorStop(0, 'rgba(255,214,110,.8)'); sg.addColorStop(1, 'rgba(255,226,150,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 28, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2c230'; c.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.48 : r; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.strokeStyle = pen; c.lineWidth = 1.3; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(sx - 3, sy - 3, 3, 1.8, -0.6, 0, Math.PI * 2); c.fill();
      // presents in front
      gift(x + 0.45, y + 0.35, 0.48, 'rgba(214,69,65,1)', '#fff8ea');
      gift(x - 0.6, y + 0.45, 0.42, 'rgba(79,143,90,1)', '#f2c230');
      gift(x - 0.05, y + 0.75, 0.34, 'rgba(242,194,48,1)', '#d64541');
      gift(x + 0.95, y - 0.2, 0.36, 'rgba(255,248,234,1)', '#d64541');
      gift(x - 1.1, y + 0.05, 0.32, 'rgba(91,143,201,1)', '#fff8ea');
    }

    // ---- Christmas like the reference photos (paper office): a lush, lightly
    // snowed fir glowing with warm fairy lights, red velvet bows, glossy red and
    // gold baubles and a red star; fir garlands with bows and warm lights, and
    // lush wreaths with a big bow and two gold bells. Brown pen lines throughout.

    bauble(x, y, r, col) {
      const c = this.ctx;
      const g = c.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
      g.addColorStop(0, col === 'gold' ? '#fff1b8' : '#ff9a8a');
      g.addColorStop(0.45, col === 'gold' ? '#e9b53b' : '#d2322f');
      g.addColorStop(1, col === 'gold' ? '#a8761a' : '#8e1b1d');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(90,60,40,.55)'; c.lineWidth = 0.6; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c9a24c'; c.fillRect(x - r * 0.25, y - r - 1.2, r * 0.5, 1.6);
    }

    velvetBow(x, y, s) {
      const c = this.ctx, pen = 'rgba(110,30,30,.9)';
      c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round';
      // tails
      for (const d of [-1, 1]) {
        c.beginPath(); c.moveTo(d * 1, 1); c.quadraticCurveTo(d * 3, 7, d * 2, 13); c.lineTo(d * 4.5, 11.5); c.lineTo(d * 5.5, 14); c.quadraticCurveTo(d * 6, 7, d * 2.5, 0.5); c.closePath();
        c.fillStyle = '#b52a2a'; c.fill(); c.strokeStyle = pen; c.lineWidth = 0.7; c.stroke();
      }
      // loops
      for (const d of [-1, 1]) {
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(d * 4, -7, d * 11, -5, d * 9, 1); c.bezierCurveTo(d * 8, 4, d * 3, 3, 0, 0);
        const g = c.createLinearGradient(0, -6, 0, 4); g.addColorStop(0, '#e2463f'); g.addColorStop(1, '#a3221f');
        c.fillStyle = g; c.fill(); c.strokeStyle = pen; c.lineWidth = 0.7; c.stroke();
        c.strokeStyle = 'rgba(255,200,190,.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(d * 3, -3); c.quadraticCurveTo(d * 6, -5, d * 8, -2.5); c.stroke();
      }
      c.fillStyle = '#c62f2f'; c.beginPath(); c.ellipse(0, 0, 2.4, 2.8, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = pen; c.stroke();
      c.restore();
    }

    photoTree(x, y) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const pen = 'rgba(70,55,40,.75)';
      const rnd = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      const gift = (gx, gy, s, col, rib) => {
        const h = s * 0.8;
        this.box(gx, gy, 0, s, s, h, this.shade(col, 14), col, this.shade(col, -18));
        c.strokeStyle = rib; c.lineWidth = 1.8;
        const a0 = P(gx + s / 2, gy, h), a1 = P(gx + s / 2, gy + s, h), a2 = P(gx + s / 2, gy + s, 0);
        c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.lineTo(a2.x, a2.y); c.stroke();
        const b0 = P(gx, gy + s / 2, h), b1 = P(gx + s, gy + s / 2, h), b2 = P(gx + s, gy + s / 2, 0);
        c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.lineTo(b2.x, b2.y); c.stroke();
        const top = P(gx + s / 2, gy + s / 2, h);
        this.velvetBow(top.x, top.y - 1, 0.45);
      };
      const base = P(x, y, 0.42);
      // big warm glow
      const gl = c.createRadialGradient(base.x, base.y - 85, 10, base.x, base.y - 85, 150);
      gl.addColorStop(0, 'rgba(255,205,110,.42)'); gl.addColorStop(1, 'rgba(255,205,110,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(base.x, base.y - 85, 150, 0, Math.PI * 2); c.fill();
      gift(x - 1.0, y - 0.7, 0.46, 'rgba(200,52,48,1)', '#f2c230');
      gift(x + 0.3, y - 1.0, 0.4, 'rgba(250,244,230,1)', '#c62f2f');
      // woven basket + trunk
      this.box(x - 0.32, y - 0.32, 0, 0.64, 0.64, 0.34, '#d8bd98', '#c9a983', '#b8956d');
      const bq = P(x, y + 0.32, 0.17);
      c.strokeStyle = 'rgba(90,60,40,.35)'; c.lineWidth = 0.8;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(bq.x + k * 6 - 3, bq.y - 6 + k * 3); c.lineTo(bq.x + k * 6 + 3, bq.y + 4 + k * 3); c.stroke(); }
      this.box(x - 0.09, y - 0.09, 0.34, 0.18, 0.18, 0.14, '#8a6648', '#7a5a40', '#6a4c36');
      // lush tiers: a dark silhouette, then layers of needle fronds, snow on the tips
      const tiers = [[88, 46, 0], [76, 42, 30], [64, 38, 58], [52, 34, 84], [40, 30, 106], [28, 26, 126]];
      const tri = [];
      tiers.forEach(([hw, h, up], i) => {
        const bx = base.x, by = base.y - up, top = by - h - 14;
        tri.push({ bx, by, hw, top });
        c.fillStyle = '#2f6b40';
        c.beginPath(); c.moveTo(bx - hw, by);
        for (let k = 0; k <= 10; k++) { const px = bx - hw + (2 * hw) * k / 10; c.quadraticCurveTo(px - hw / 10, by + 7, px, by); }
        c.lineTo(bx, top); c.closePath(); c.fill();
        c.strokeStyle = pen; c.lineWidth = 1.1; c.stroke();
        // fronds: little fans of needles all over, lighter towards the front/left
        let n = i * 300;
        const cnt = Math.round(hw * 0.9);
        for (let k = 0; k < cnt; k++, n++) {
          const g = rnd(n) * 0.95, w = hw * (1 - g) * 0.95, fx = bx - w + rnd(n + 1) * w * 2, fy = by - 2 - (by - top) * g * 0.95;
          const len = 4 + rnd(n + 2) * 4, ang = Math.PI / 2 + (fx - bx) / hw * 0.6;
          const light = rnd(n + 3);
          c.strokeStyle = light > 0.66 ? '#6fae72' : light > 0.33 ? '#4e9058' : '#3d7d4b'; c.lineWidth = 1.1; c.lineCap = 'round';
          c.beginPath();
          for (const da of [-0.5, -0.2, 0.15, 0.45]) { c.moveTo(fx, fy); c.lineTo(fx + Math.cos(ang + da) * len, fy + Math.sin(ang + da) * len); }
          c.stroke();
          if (rnd(n + 4) > 0.8) { c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.ellipse(fx + 1, fy - 0.5, 2.6, 1.3, 0, 0, Math.PI * 2); c.fill(); }
        }
        // snow along the hem
        c.fillStyle = 'rgba(255,255,255,.9)';
        for (let k = 0; k < 10; k++) { if (rnd(i * 40 + k) < 0.45) continue; const px = bx - hw + (2 * hw) * (k + 0.5) / 10; c.beginPath(); c.ellipse(px, by - 2, hw / 14, 2.2, 0, Math.PI, 0); c.fill(); }
      });
      const at = (i, f, g) => { const q = tri[i]; const w = q.hw * (1 - g) * 0.9; return { x: q.bx - w + 2 * w * f, y: q.by - 4 - (q.by - q.top) * g * 0.85 }; };
      // dense warm fairy lights
      let n = 0;
      for (let i = 0; i < tri.length; i++) {
        for (let k = 0; k < 46 - i * 6; k++, n++) {
          const q = at(i, rnd(n + 500), rnd(n + 1500) * 0.92);
          const tw = 0.5 + 0.5 * Math.sin(t * (1.6 + rnd(n + 7) * 2.6) + n);
          c.globalAlpha = 0.28 + 0.45 * tw; c.fillStyle = '#ffd36e'; c.beginPath(); c.arc(q.x, q.y, 3.4, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.8 + 0.2 * tw; c.fillStyle = '#fff8dc'; c.beginPath(); c.arc(q.x, q.y, 1.15, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
      // glossy red and gold baubles
      n = 0;
      for (let i = 0; i < tri.length; i++) {
        const count = 7 - Math.floor(i / 1.2);
        for (let k = 0; k < count; k++, n++) {
          const q = at(i, (k + 0.5) / count + (rnd(n + 50) - 0.5) * 0.08, 0.08 + rnd(n + 77) * 0.32);
          this.bauble(q.x, q.y, 4.6 - i * 0.35, n % 3 === 1 ? 'gold' : 'red');
        }
      }
      // red velvet bows
      [[0, 0.2, 0.32], [0, 0.8, 0.28], [1, 0.5, 0.45], [2, 0.18, 0.3], [2, 0.82, 0.34], [3, 0.5, 0.35], [4, 0.28, 0.3], [4, 0.75, 0.32]]
        .forEach(([i, f, g]) => { const q = at(i, f, g); this.velvetBow(q.x, q.y, 0.75 - i * 0.05); });
      // red star with gold edge
      const TOP = 126 + 26 + 14, sx = base.x, sy = base.y - TOP - 6, r = 14 + Math.sin(t * 2) * 0.8;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 36);
      sg.addColorStop(0, 'rgba(255,205,120,.8)'); sg.addColorStop(1, 'rgba(255,205,120,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 36, 0, Math.PI * 2); c.fill();
      const star = (rr) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? rr * 0.46 : rr; c.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } c.closePath(); };
      star(r); const sgr = c.createLinearGradient(sx, sy - r, sx, sy + r); sgr.addColorStop(0, '#ef5b4f'); sgr.addColorStop(1, '#a8211f');
      c.fillStyle = sgr; c.fill(); c.strokeStyle = '#f2c230'; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
      c.strokeStyle = pen; c.lineWidth = 0.6; c.stroke();
      for (let k = 0; k < 6; k++) { const a = t * 1.3 + k * 1.05, q = r * 0.55; c.fillStyle = 'rgba(255,245,210,.95)'; c.beginPath(); c.arc(sx + Math.cos(a) * q, sy + Math.sin(a) * q, 0.9, 0, Math.PI * 2); c.fill(); }
      // presents in front
      gift(x + 0.45, y + 0.35, 0.48, 'rgba(250,244,230,1)', '#c62f2f');
      gift(x - 0.6, y + 0.45, 0.42, 'rgba(200,52,48,1)', '#f2c230');
      gift(x - 0.05, y + 0.75, 0.34, 'rgba(233,181,59,1)', '#c62f2f');
      gift(x + 0.95, y - 0.2, 0.36, 'rgba(62,120,80,1)', '#f2c230');
      gift(x - 1.1, y + 0.05, 0.32, 'rgba(200,52,48,1)', '#fff8ea');
    }

    photoWalls() {
      const { W, D } = this.plan;
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000, WH = this.plan.WH;
      const dy = this.plan.door.y;
      const rnd = (n) => { const v = Math.sin(n * 91.7 + 13.1) * 43758.5453; return v - Math.floor(v); };
      // lush fir garland swagged along the top of both walls
      const run = (len, at, seed, skip) => {
        const span = 1.4;
        for (let u0 = 0.05; u0 < len - 0.1; u0 += span) {
          const u1 = Math.min(len - 0.05, u0 + span);
          if (skip && u1 > skip[0] && u0 < skip[1]) continue;
          const zAt = (u) => WH + 0.02 - Math.sin(((u - u0) / (u1 - u0)) * Math.PI) * 0.2;
          let n = Math.floor(u0 * 100) + seed * 1000;
          for (let u = u0; u <= u1; u += 0.07, n++) {
            const q = at(u, zAt(u));
            c.fillStyle = rnd(n) > 0.5 ? '#3d7d4b' : '#2f6b40'; c.beginPath(); c.arc(q.x, q.y, 3.6, 0, Math.PI * 2); c.fill();
            c.strokeStyle = rnd(n + 1) > 0.5 ? '#6fae72' : '#4e9058'; c.lineWidth = 1; c.lineCap = 'round';
            c.beginPath(); for (const a of [0.3, 1.6, 2.9, 4.4]) { const aa = a + rnd(n + 2); c.moveTo(q.x, q.y); c.lineTo(q.x + Math.cos(aa) * 5, q.y + Math.sin(aa) * 3.5); } c.stroke();
            if (rnd(n + 3) > 0.85) { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(q.x, q.y - 2.5, 2.4, 1.1, 0, 0, Math.PI * 2); c.fill(); }
          }
          // warm white lights along the swag
          for (let u = u0 + 0.12; u < u1; u += 0.22, n++) {
            const q = at(u, zAt(u) - 0.03), tw = 0.5 + 0.5 * Math.sin(t * 2 + n);
            c.globalAlpha = 0.3 + 0.4 * tw; c.fillStyle = '#ffd36e'; c.beginPath(); c.arc(q.x, q.y + 1, 3.6, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 0.85 + 0.15 * tw; c.fillStyle = '#fff8dc'; c.beginPath(); c.arc(q.x, q.y + 1, 1.2, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 1;
          }
          // a gold bauble hanging mid-swag, red velvet bows where it's pinned up
          const mq = at((u0 + u1) / 2, zAt((u0 + u1) / 2) - 0.12);
          c.strokeStyle = 'rgba(160,120,60,.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(mq.x, mq.y - 4); c.lineTo(mq.x, mq.y); c.stroke();
          this.bauble(mq.x, mq.y + 3, 3.2, Math.round(u0 / span) % 2 ? 'gold' : 'red');
          const pq = at(u0, zAt(u0));
          this.velvetBow(pq.x, pq.y - 1, 0.55);
        }
      };
      run(W, (u, z) => P(u, 0, z), 0);
      run(D, (u, z) => P(0, u, z), 1, [dy - 0.75, dy + 0.75]);
      // lush wreaths with a big red bow and two gold bells
      const wreath = (dir, a, z, r) => {
        this.onWall(dir, a, z, (cc) => {
          let n = Math.floor(a * 37 + z * 11);
          for (let k = 0; k < 40; k++, n++) {
            const ang = rnd(n) * Math.PI * 2, rr = r * (0.75 + rnd(n + 1) * 0.5), x0 = Math.cos(ang) * rr, y0 = Math.sin(ang) * rr;
            cc.strokeStyle = rnd(n + 2) > 0.5 ? '#3d7d4b' : rnd(n + 3) > 0.5 ? '#2f6b40' : '#6fae72'; cc.lineWidth = 1.3; cc.lineCap = 'round';
            cc.beginPath(); const tang = ang + Math.PI / 2; cc.moveTo(x0 - Math.cos(tang) * 3, y0 - Math.sin(tang) * 3); cc.lineTo(x0 + Math.cos(tang) * 3, y0 + Math.sin(tang) * 3); cc.stroke();
          }
          // pinecones and berry clusters
          for (const ang of [0.9, 2.5, 4.1, 5.5]) {
            const x0 = Math.cos(ang) * r, y0 = Math.sin(ang) * r;
            cc.fillStyle = '#8a5a3a'; cc.beginPath(); cc.ellipse(x0, y0, 1.6, 2.4, ang, 0, Math.PI * 2); cc.fill();
            cc.fillStyle = '#c62f2f'; for (const [ox, oy] of [[2.4, 0.8], [3.4, -0.6], [2.8, 1.9]]) { cc.beginPath(); cc.arc(x0 + ox, y0 + oy, 1.1, 0, Math.PI * 2); cc.fill(); }
          }
          cc.fillStyle = 'rgba(255,255,255,.85)'; for (const ang of [3.6, 4.6, 5.3]) { cc.beginPath(); cc.ellipse(Math.cos(ang) * r, Math.sin(ang) * r - 1, 2.2, 1, 0, 0, Math.PI * 2); cc.fill(); }
        });
        // bells and bow drawn upright under the wreath
        const q = dir === 'y0' ? P(a, 0, z) : P(0, a, z);
        for (const d of [-1, 1]) {
          const bx = q.x + d * 2.6, by = q.y + r + 4;
          c.strokeStyle = 'rgba(160,30,30,.9)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(q.x, q.y + r * 0.9); c.lineTo(bx, by - 3); c.stroke();
          const g = c.createLinearGradient(bx - 3, by, bx + 3, by); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#e9b53b'); g.addColorStop(1, '#a8761a');
          c.fillStyle = g; c.beginPath(); c.moveTo(bx - 3.4, by + 3); c.quadraticCurveTo(bx - 3, by - 3.5, bx, by - 3.5); c.quadraticCurveTo(bx + 3, by - 3.5, bx + 3.4, by + 3); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(90,60,30,.7)'; c.lineWidth = 0.5; c.stroke();
          c.fillStyle = '#8a6420'; c.beginPath(); c.arc(bx, by + 3.4, 1, 0, Math.PI * 2); c.fill();
        }
        this.velvetBow(q.x, q.y + r * 0.85, 0.7);
      };
      wreath('x0', dy, 1.62, 8);
      wreath('x0', 3.2, 0.72, 7.5);
      for (const u of [4.45, 9.2]) wreath('y0', u, 0.78, 7.5);
    }

    // ---- Christmas, "paper picture-book" (designed by GPT, see the spec in
    // the commit): a wide, simple five-tier tree in matte green, a few flat red
    // baubles, three butter paper stars, 16 small lights, a red star on top;
    // a light rope garland with leaf clusters and red bows, one door wreath.
    // All sizes are screen pixels at zoom 1, in a 175×190 box around the tree.

    gptTree(x, y) {
      const c = this.ctx, F = this.iso(x, y, 0);
      const ox = F.x - 87.5, oy = F.y - 176;
      const X = (v) => ox + v, Y = (v) => oy + v;
      const INK = '#70584a';
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
      // trunk (behind the leaves)
      c.fillStyle = '#95765b'; c.fillRect(X(82.5), Y(153), 10, 15);
      // tiers, bottom first: [top y, bottom y, max width]
      const tiers = [[19, 55, 43], [39, 80, 73], [61, 105, 105], [85, 131, 138], [109, 158, 170]];
      const blotch = [[-0.18, 0.45], [-0.2, 0.5], [-0.22, 0.48], [-0.2, 0.5], [-0.22, 0.52]];
      for (let i = tiers.length - 1; i >= 0; i--) {
        const [y0, y1, w] = tiers[i], cx = 87.5, L = cx - w / 2, R = cx + w / 2, h = y1 - y0;
        const sides = () => {
          c.moveTo(L + 3, y1 + 0.5);
          c.quadraticCurveTo(L - 0.5, y1 - 0.5, L + 1.5, y1 - 3);
          c.quadraticCurveTo(cx - w * 0.3 - 3, y0 + h * 0.45, cx - 3, y0 + 3);
          c.quadraticCurveTo(cx, y0 - 1, cx + 3, y0 + 3);
          c.quadraticCurveTo(cx + w * 0.3 + 3, y0 + h * 0.45, R - 1.5, y1 - 3);
          c.quadraticCurveTo(R + 0.5, y1 - 0.5, R - 3, y1 + 0.5);
        };
        const bottom = () => { c.quadraticCurveTo(cx, y1 + 5, L + 3, y1 + 0.5); };
        c.save(); c.translate(ox, oy);
        c.beginPath(); sides(); bottom(); c.closePath();
        c.fillStyle = '#526f58'; c.fill();
        c.save(); c.clip();
        c.globalAlpha = 0.06; c.fillStyle = '#819474';
        c.beginPath(); c.ellipse(cx + blotch[i][0] * w, y0 + h * blotch[i][1], w * 0.2, h * 0.28, -0.4, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.08; c.fillStyle = '#405b49';
        c.beginPath(); c.ellipse(cx + w * 0.3, y1 - h * 0.14, w * 0.18, h * 0.16, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.045; c.fillStyle = '#2f3f33';
        for (let k = 0; k < w * h / 100; k++) { const v1 = Math.sin((i * 997 + k) * 12.9898) * 43758.5453, v2 = Math.sin((i * 997 + k) * 78.233) * 43758.5453; c.beginPath(); c.arc(L + (v1 - Math.floor(v1)) * w, y0 + (v2 - Math.floor(v2)) * h, 0.3, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1;
        c.restore();
        c.strokeStyle = INK; c.lineWidth = 1.1;
        c.beginPath(); sides(); c.stroke();
        // bottom edge: silhouette at the ends, a faint seam in the middle 60%
        const bez = (u) => { const a = R - 3, b = L + 3, yy = y1 + 0.5; return { x: (1 - u) * (1 - u) * a + 2 * (1 - u) * u * cx + u * u * b, y: (1 - u) * (1 - u) * yy + 2 * (1 - u) * u * (y1 + 5) + u * u * yy }; };
        const seg = (u0, u1, lw, alpha) => { c.globalAlpha = alpha; c.lineWidth = lw; c.beginPath(); for (let u = u0; u <= u1 + 1e-6; u += 0.05) { const q = bez(u); u === u0 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y); } c.stroke(); c.globalAlpha = 1; };
        if (i === tiers.length - 1) seg(0, 1, 1.1, 1);
        else { seg(0, 0.2, 1.1, 1); seg(0.2, 0.8, 0.7, 0.45); seg(0.8, 1, 1.1, 1); }
        c.restore();
      }
      // pot
      const pt = Y(163), pb = Y(183), cxp = X(87.5);
      c.beginPath(); c.moveTo(cxp - 16.5, pt + 2.5); c.lineTo(cxp - 13.5, pb); c.lineTo(cxp + 13.5, pb); c.lineTo(cxp + 16.5, pt + 2.5); c.closePath();
      c.fillStyle = '#e8d8c3'; c.fill();
      c.beginPath(); c.moveTo(cxp + 4, pt + 2.5); c.lineTo(cxp + 4, pb); c.lineTo(cxp + 13.5, pb); c.lineTo(cxp + 16.5, pt + 2.5); c.closePath();
      c.fillStyle = '#c9b69c'; c.fill();
      c.beginPath(); c.moveTo(cxp - 16.5, pt + 2.5); c.lineTo(cxp - 13.5, pb); c.lineTo(cxp + 13.5, pb); c.lineTo(cxp + 16.5, pt + 2.5); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
      c.beginPath(); c.ellipse(cxp, pt + 2.5, 16.5, 2.5, 0, 0, Math.PI * 2); c.fillStyle = '#e8d8c3'; c.fill(); c.stroke();
      // flat red baubles with a short hanging line
      const balls = [[82, 43, 7], [105, 65, 7], [65, 83, 7], [92, 97, 8], [124, 112, 8], [48, 123, 8], [76, 140, 9], [111, 145, 9], [151, 145, 9]];
      for (const [bx, by, d] of balls) {
        c.strokeStyle = INK; c.lineWidth = 0.7; c.beginPath(); c.moveTo(X(bx), Y(by) - d / 2 - 2); c.lineTo(X(bx), Y(by) - d / 2); c.stroke();
        c.fillStyle = '#b96355'; c.beginPath(); c.arc(X(bx), Y(by), d / 2, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.65; c.lineWidth = 0.65; c.stroke(); c.globalAlpha = 1;
      }
      // butter paper stars
      const star = (sx, sy, r, inner) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * inner : r; c.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } c.closePath(); };
      c.fillStyle = '#e6c779';
      for (const [sx, sy] of [[80, 68], [111, 91], [96, 123]]) { star(X(sx), Y(sy), 3.2, 0.5); c.fill(); }
      // 16 small lights, no glow
      c.globalAlpha = 0.95; c.fillStyle = '#f5e3aa';
      for (const [lx, ly] of [[81, 31], [93, 39], [100, 49], [65, 63], [74, 74], [93, 79], [113, 77], [49, 98], [65, 109], [85, 114], [134, 119], [30, 135], [48, 143], [90, 149], [131, 146], [154, 137]]) {
        c.beginPath(); c.arc(X(lx), Y(ly), 1.2, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      // red star topper
      const tx = X(87.5), ty = Y(10.5);
      star(tx, ty, 9.5, 0.47); c.fillStyle = '#b96355'; c.fill(); c.strokeStyle = '#806b59'; c.lineWidth = 1; c.stroke();
      // three presents, low by the pot
      const gift = (gcx, gbot, gw, gh, box, rib) => {
        const s = gw / 64, h = (gh - s * 32) / 32;
        const dx = gcx - 87.5, dy = gbot - 176;
        const ux = (dx / 32 + dy / 16) / 2, uy = (dy / 16 - dx / 32) / 2;
        const gx = x + ux - s, gy = y + uy - s;
        this.box(gx, gy, 0, s, s, h, box, box, box);
        const P = (a, b, cc) => this.iso(a, b, cc);
        c.globalAlpha = 0.08; c.fillStyle = INK; c.beginPath(); [P(gx + s, gy, 0), P(gx + s, gy + s, 0), P(gx + s, gy + s, h), P(gx + s, gy, h)].forEach((q, k) => (k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = rib; c.lineWidth = 2;
        const a0 = P(gx + s / 2, gy, h), a1 = P(gx + s / 2, gy + s, h), a2 = P(gx + s / 2, gy + s, 0);
        c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.lineTo(a2.x, a2.y); c.stroke();
        const b0 = P(gx, gy + s / 2, h), b1 = P(gx + s, gy + s / 2, h), b2 = P(gx + s, gy + s / 2, 0);
        c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.lineTo(b2.x, b2.y); c.stroke();
        const top = P(gx + s / 2, gy + s / 2, h);
        c.fillStyle = rib; c.strokeStyle = INK; c.lineWidth = 0.5;
        for (const d of [-1, 1]) { c.beginPath(); c.ellipse(top.x + d * 1.7, top.y - 1.2, 1.5, 1, d * 0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
      };
      gift(49, 181, 24, 19, 'rgba(185,99,85,1)', '#faf6ed');
      gift(116, 186, 27, 21, 'rgba(232,216,195,1)', '#b96355');
      gift(65, 190, 19, 15, 'rgba(250,246,237,1)', '#b96355');
      c.restore();
    }

    // Cream mat under the tree (instead of a skirt).
    gptMat(x, y) {
      const c = this.ctx, F = this.iso(x, y, 0);
      c.save(); c.globalAlpha = 0.45; c.fillStyle = '#e8d8c3';
      c.beginPath(); c.ellipse(F.x, F.y, 56, 12, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }

    // A light rope garland on the walls: leaf clusters at the pins, a red bow at
    // every second pin; one wreath on the door.
    gptWalls() {
      const { W, D } = this.plan, WH = this.plan.WH, dy = this.plan.door.y;
      const c = this.ctx, P = (a, b, cc) => this.iso(a, b, cc);
      const INK = '#70584a';
      const PX = Math.hypot(TW / 2, TH / 2);            // screen px per tile along a wall
      const zPin = WH - 4 / TH, sag = 6.5 / TH;
      let pinNo = 0;
      const bow = (q) => {
        c.fillStyle = '#b96355'; c.strokeStyle = INK; c.lineWidth = 0.5;
        for (const d of [-1, 1]) { c.beginPath(); c.ellipse(q.x + d * 2.4, q.y, 2.5, 1.5, d * 0.3, 0, Math.PI * 2); c.fill(); c.stroke(); }
        c.strokeStyle = '#b96355'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(q.x - 0.5, q.y + 0.8); c.lineTo(q.x - 1.4, q.y + 2.8); c.moveTo(q.x + 0.5, q.y + 0.8); c.lineTo(q.x + 1.4, q.y + 2.8); c.stroke();
        c.fillStyle = '#b96355'; c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.arc(q.x, q.y, 1, 0, Math.PI * 2); c.fill(); c.stroke();
      };
      const leaves = (q) => {
        for (const [ang, col] of [[-2.4, '#526f58'], [-0.7, '#819474'], [1.6, '#526f58']]) {
          c.save(); c.translate(q.x + Math.cos(ang) * 2.4, q.y + Math.sin(ang) * 1.6); c.rotate(ang);
          c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 2.5, 1.25, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
      };
      const run = (u0, u1, at) => {
        const inset = 12 / PX, a = u0 + inset, b = u1 - inset;
        if (b - a < 0.5) return;
        const n = Math.max(1, Math.round(((b - a) * PX) / 76));
        const pins = Array.from({ length: n + 1 }, (_, k) => a + (b - a) * k / n);
        c.strokeStyle = '#819474'; c.lineWidth = 1.2; c.lineCap = 'round';
        for (let k = 0; k < n; k++) {
          c.beginPath();
          for (let s = 0; s <= 1.0001; s += 0.05) { const u = pins[k] + (pins[k + 1] - pins[k]) * s, q = at(u, zPin - Math.sin(s * Math.PI) * sag); s === 0 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y); }
          c.stroke();
        }
        for (const u of pins) { const q = at(u, zPin); leaves(q); if (pinNo++ % 2 === 0) bow({ x: q.x, y: q.y + 4.5 }); }
      };
      run(0, W, (u, z) => P(u, 0, z));
      run(0, dy - 0.62, (u, z) => P(0, u, z));
      run(dy + 0.62, D, (u, z) => P(0, u, z));
      // door wreath
      const q = P(0, dy, 1.5);
      c.strokeStyle = '#526f58'; c.lineWidth = 3; c.beginPath(); c.arc(q.x, q.y, 7.5, 0, Math.PI * 2); c.stroke();
      for (let k = 0; k < 8; k++) {
        const ang = k / 8 * Math.PI * 2;
        c.save(); c.translate(q.x + Math.cos(ang) * 8.2, q.y + Math.sin(ang) * 8.2); c.rotate(ang + Math.PI / 2);
        c.fillStyle = k % 2 ? '#819474' : '#526f58'; c.beginPath(); c.ellipse(0, 0, 2, 1, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
      bow({ x: q.x, y: q.y + 8 });
    }

    // Claw machine full of plushies.
    clawMachine(x, y) {
      const P = (a, b, cc) => this.iso(a, b, cc), c = this.ctx, t = this.t / 1000;
      this.box(x, y, 0, 0.8, 0.8, 0.8, '#e9b8aa', '#e9b8aa', '#d9a596');
      // glass case with plushies
      const pl = [['#faf6ed', 0.25, 0.3], ['#e7c66b', 0.55, 0.25], ['#d9cfe0', 0.4, 0.55], ['#b8c7b0', 0.65, 0.6]];
      for (const [col, px, py] of pl) { const q = P(x + px, y + py, 0.85); c.fillStyle = col; c.strokeStyle = 'rgba(112,88,74,.6)'; c.lineWidth = 0.8; c.beginPath(); c.arc(q.x, q.y - 3, 4.5, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.arc(q.x - 3, q.y - 7, 1.6, 0, Math.PI * 2); c.arc(q.x + 3, q.y - 7, 1.6, 0, Math.PI * 2); c.fill(); }
      this.poly([P(x, y + 0.8, 0.8), P(x + 0.8, y + 0.8, 0.8), P(x + 0.8, y + 0.8, 1.6), P(x, y + 0.8, 1.6)], 'rgba(220,236,245,.35)', 'rgba(112,88,74,.6)', 0.9);
      this.poly([P(x + 0.8, y, 0.8), P(x + 0.8, y + 0.8, 0.8), P(x + 0.8, y + 0.8, 1.6), P(x + 0.8, y, 1.6)], 'rgba(220,236,245,.3)', 'rgba(112,88,74,.6)', 0.9);
      // the claw drifting back and forth
      const cx = x + 0.4 + Math.sin(t * 0.8) * 0.25, top = P(cx, y + 0.4, 1.6), low = P(cx, y + 0.4, 1.25 + Math.abs(Math.sin(t * 0.5)) * 0.25);
      c.strokeStyle = '#8c7a6e'; c.lineWidth = 1; c.beginPath(); c.moveTo(top.x, top.y); c.lineTo(low.x, low.y); c.moveTo(low.x - 4, low.y + 4); c.lineTo(low.x, low.y); c.lineTo(low.x + 4, low.y + 4); c.stroke();
      this.box(x - 0.02, y - 0.02, 1.6, 0.84, 0.84, 0.22, '#faf6ed', '#e9b8aa', '#d9a596');
      const s = P(x + 0.4, y + 0.82, 1.71);
      c.fillStyle = '#70584a'; c.font = '800 6px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('인형뽑기', s.x, s.y);
    }

    // Santa hat sitting on the top of the head (drawn in the sprite's own space).
    santaHat(top, W, t) {
      const c = this.ctx;
      const w = Math.max(10, W * 0.42), h = w * 0.8, flop = Math.sin(t * 2) * 1.5;
      const y0 = top + w * 0.12;
      const paper = this.plan && this.plan.paper, pen = 'rgba(112,88,74,.8)';
      c.fillStyle = paper ? '#d64541' : '#e02b2b';
      c.beginPath(); c.moveTo(-w / 2, y0); c.quadraticCurveTo(-w * 0.2, y0 - h, w * 0.55 + flop, y0 - h * 0.55); c.lineTo(w / 2, y0); c.closePath(); c.fill();
      c.strokeStyle = paper ? pen : '#9b1414'; c.lineWidth = paper ? 0.9 : 0.7; c.stroke();
      if (paper) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-w * 0.12, y0 - h * 0.42, w * 0.12, h * 0.18, -0.5, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = paper ? '#fff8ea' : '#ffffff';
      c.beginPath(); c.ellipse(0, y0, w * 0.58, w * 0.16, 0, 0, Math.PI * 2); c.fill();
      if (paper) { c.strokeStyle = pen; c.lineWidth = 0.8; c.stroke(); }
      c.beginPath(); c.arc(w * 0.55 + flop, y0 - h * 0.55, w * 0.14, 0, Math.PI * 2); c.fill();
      if (paper) c.stroke();
    }

    // A short run of twinkling colored bulbs along a divider top (x direction).
    lightString(x, y, len, z) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const cols = ['#ff4d4d', '#ffd23f', '#4db8ff', '#5ee07a', '#ff7ad9'];
      c.strokeStyle = '#2f5a35'; c.lineWidth = 0.7; c.beginPath();
      for (let u = 0; u <= len; u += 0.1) { const q = P(x + u, y, z - Math.sin((u % 0.6) / 0.6 * Math.PI) * 0.05); u ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }
      c.stroke();
      let i = 0;
      for (let u = 0.15; u < len; u += 0.3, i++) {
        const q = P(x + u, y, z - 0.05);
        const on = Math.sin(t * 3 + i * 1.1 + x) > -0.3;
        const col = cols[i % cols.length];
        if (on) { c.globalAlpha = 0.3; c.fillStyle = col; c.beginPath(); c.arc(q.x, q.y + 1.5, 4.5, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = on ? 1 : 0.35;
        c.fillStyle = col; c.beginPath(); c.ellipse(q.x, q.y + 1.5, 1.6, 2.2, 0, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }

    // Tree skirt: a red round rug with white trim, under the tree (floor layer).
    treeSkirt(x, y) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const ring = (r) => Array.from({ length: 28 }, (_, k) => { const a = (k / 28) * Math.PI * 2; return P(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.01); });
      if (this.plan && this.plan.paper) return this.gptMat(x, y);
      if (this.plan && this.plan.paper) {
        this.poly(ring(1.5), 'rgba(214,69,65,1)', 'rgba(112,88,74,.6)', 1);
        this.poly(ring(1.32), 'rgba(255,248,234,1)', 'rgba(112,88,74,.35)', 0.8);
        const c = this.ctx; c.fillStyle = 'rgba(214,69,65,.9)';
        for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, q = P(x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1, 0.01); c.beginPath(); c.arc(q.x, q.y, 1.5, 0, Math.PI * 2); c.fill(); }
        return;
      }
      this.poly(ring(1.45), '#f7f2ea');
      this.poly(ring(1.32), '#d42a2a');
      const c = this.ctx;
      c.fillStyle = '#ffffff';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, q = P(x + Math.cos(a) * 1.0, y + Math.sin(a) * 1.0, 0.01);
        c.beginPath(); c.arc(q.x, q.y, 1.6, 0, Math.PI * 2); c.fill();
      }
    }

    // Snowman with a hat and a scarf.
    snowman(x, y, hat) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const b = P(x, y, 0);
      const paper = this.plan && this.plan.paper;
      const ink = paper ? 'rgba(112,88,74,.8)' : (this.pal.ink || '#5b4032');
      const K = paper
        ? { snow: '#fffdf8', btn: '#d64541', eye: '#5e4a3e', nose: '#ef8d3a', cheek: '#f2b4ac', scarfA: '#d64541', scarfB: '#4f8f5a', arm: '#8a5e3c', hat: '#4a3a33', band: '#d64541', cone: '#d64541', trim: '#fff8ea' }
        : { snow: '#ffffff', btn: '#e8413a', eye: '#2a2018', nose: '#f08a3a', cheek: '#f6a8b8', scarfA: '#d42a2a', scarfB: '#2fa36b', arm: '#7a4a2e', hat: '#2a2a2e', band: '#d42a2a', cone: '#d42a2a', trim: '#fff' };
      c.fillStyle = paper ? 'rgba(112,88,74,.1)' : 'rgba(0,0,0,.08)'; c.beginPath(); c.ellipse(b.x, b.y, 18, 7, 0, 0, Math.PI * 2); c.fill();
      const ball = (yy, r) => {
        c.fillStyle = K.snow; c.beginPath(); c.arc(b.x, yy, r, 0, Math.PI * 2); c.fill();
        if (paper) { c.fillStyle = 'rgba(190,200,225,.35)'; c.beginPath(); c.ellipse(b.x + r * 0.3, yy + r * 0.35, r * 0.6, r * 0.45, -0.3, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = ink; c.lineWidth = 1; c.beginPath(); c.arc(b.x, yy, r, 0, Math.PI * 2); c.stroke();
      };
      ball(b.y - 14, 16); ball(b.y - 38, 12); ball(b.y - 56, 9);
      // buttons, face, carrot nose
      c.fillStyle = K.btn; for (const yy of [-30, -40]) { c.beginPath(); c.arc(b.x, b.y + yy, 1.8, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = K.eye; c.beginPath(); c.arc(b.x - 3, b.y - 58, 1.3, 0, Math.PI * 2); c.arc(b.x + 3, b.y - 58, 1.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = K.nose; c.beginPath(); c.moveTo(b.x, b.y - 55); c.lineTo(b.x + 8, b.y - 53.5); c.lineTo(b.x, b.y - 52.5); c.closePath(); c.fill();
      c.fillStyle = K.cheek; c.beginPath(); c.arc(b.x - 6, b.y - 53, 1.8, 0, Math.PI * 2); c.arc(b.x + 6, b.y - 53, 1.8, 0, Math.PI * 2); c.fill();
      // scarf
      c.fillStyle = hat === 'top' ? K.scarfA : K.scarfB;
      c.beginPath(); c.ellipse(b.x, b.y - 47, 10, 3, 0, 0, Math.PI * 2); c.fill();
      if (paper) { c.strokeStyle = ink; c.lineWidth = 0.7; c.stroke(); }
      c.fillRect(b.x + 3, b.y - 47, 4, 12 + Math.sin(t * 2) * 1);
      if (paper) c.strokeRect(b.x + 3, b.y - 47, 4, 12 + Math.sin(t * 2) * 1);
      // stick arms
      c.strokeStyle = K.arm; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(b.x - 11, b.y - 40); c.lineTo(b.x - 24, b.y - 50); c.moveTo(b.x + 11, b.y - 40); c.lineTo(b.x + 24, b.y - 48 + Math.sin(t * 3) * 2); c.stroke();
      if (hat === 'top') {
        c.fillStyle = K.hat; c.fillRect(b.x - 11, b.y - 65, 22, 3); c.fillRect(b.x - 7, b.y - 78, 14, 14);
        c.fillStyle = K.band; c.fillRect(b.x - 7, b.y - 68, 14, 3);
        if (paper) { c.strokeStyle = ink; c.lineWidth = 0.8; c.strokeRect(b.x - 11, b.y - 65, 22, 3); c.strokeRect(b.x - 7, b.y - 78, 14, 13); }
      } else {
        c.fillStyle = K.cone; c.beginPath(); c.moveTo(b.x - 9, b.y - 62); c.lineTo(b.x + 9, b.y - 62); c.lineTo(b.x + 12, b.y - 78); c.closePath(); c.fill();
        if (paper) { c.strokeStyle = ink; c.lineWidth = 0.8; c.stroke(); }
        c.fillStyle = K.trim; c.fillRect(b.x - 10, b.y - 64, 20, 4); c.beginPath(); c.arc(b.x + 12, b.y - 78, 3, 0, Math.PI * 2); c.fill();
        if (paper) { c.strokeRect(b.x - 10, b.y - 64, 20, 4); c.beginPath(); c.arc(b.x + 12, b.y - 78, 3, 0, Math.PI * 2); c.stroke(); }
      }
    }

    // The stall's cart: orange body, big blue wheels, glass case of fish breads,
    // a picture signboard, the iron mold browning more fish, and steam.
    bungeoCart(x, y) {
      const P = (a, b, cc) => this.iso(a, b, cc);
      const c = this.ctx, t = this.t / 1000;
      const W = 1.5, D = 0.75;
      const PA = this.plan && this.plan.paper;
      const K = PA ? { body: ['#f0d3a8', '#e3bd8a', '#d4a974'], wheel: '#9cbc95', rim: 'rgba(112,88,74,.8)', hub: '#faf6ed', caster: '#8c7a6e', mold: ['#8c7a6e', '#7a6a5f', '#6c5d53'], sign: '#f3e3b0', signLine: '#9cbc95', t1: '#d47c6e', t2: '#70584a' }
        : { body: ['#f6b26b', '#e8873a', '#d0712a'], wheel: '#2f6fd6', rim: '#1d4fa0', hub: '#f2f2f2', caster: '#444', mold: ['#3d3532', '#2c2522', '#241e1b'], sign: '#ffe14d', signLine: '#2f6fd6', t1: '#e8413a', t2: '#2f6fd6' };
      // body
      this.box(x, y, 0.22, W, D, 0.58, K.body[0], K.body[1], K.body[2]);
      // big blue wheels on the right side, small caster at the front
      for (const wy of [y + 0.2, y + D - 0.2]) {
        const w = P(x + W, wy, 0.2);
        c.fillStyle = K.wheel; c.beginPath(); c.ellipse(w.x, w.y, 6.5, 8, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = K.rim; c.lineWidth = 1.2; c.stroke();
        c.fillStyle = K.hub; c.beginPath(); c.ellipse(w.x, w.y, 2.2, 2.8, 0, 0, Math.PI * 2); c.fill();
      }
      const cw = P(x + 0.2, y + D, 0.07);
      c.fillStyle = K.caster; c.beginPath(); c.arc(cw.x, cw.y, 2.5, 0, Math.PI * 2); c.fill();
      // iron mold on the right half
      this.box(x + 0.8, y + 0.1, 0.8, 0.6, D - 0.2, 0.06, K.mold[0], K.mold[1], K.mold[2]);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const q = P(x + 0.95 + i * 0.3, y + 0.24 + j * 0.27, 0.87);
        const k = ((t * 0.12 + i * 0.29 + j * 0.47) % 1);
        this.fishBread(q.x, q.y, k < 0.5 ? '#f3d49a' : k < 0.85 ? '#e9a94b' : '#d48a33', 1);
      }
      // glass display case on the left half, full of golden fish
      const gx = x + 0.1, gy = y + 0.12, gw = 0.6, gd = D - 0.24, gh = 0.38;
      this.box(gx, gy, 0.8, gw, gd, 0.03, '#d8c0a0', '#b89a78', '#a8886a');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const q = P(gx + 0.12 + i * 0.18, gy + 0.12 + j * 0.25, 0.86 + j * 0.02);
        this.fishBread(q.x, q.y, '#ecae52', 0.85);
      }
      c.globalAlpha = 0.28;
      this.box(gx, gy, 0.83, gw, gd, gh, '#eaf6ff', '#cfe8fb', '#bcdcf5');
      c.globalAlpha = 1;
      // signboard on the front face: yellow panel with a fish and the price
      const s0 = P(x + 0.18, y + D, 0.72), s1 = P(x + 0.95, y + D, 0.72), s2 = P(x + 0.95, y + D, 0.32), s3 = P(x + 0.18, y + D, 0.32);
      c.fillStyle = K.sign; c.beginPath(); c.moveTo(s0.x, s0.y); c.lineTo(s1.x, s1.y); c.lineTo(s2.x, s2.y); c.lineTo(s3.x, s3.y); c.closePath(); c.fill();
      c.strokeStyle = K.signLine; c.lineWidth = 1.2; c.stroke();
      const mid = { x: (s0.x + s2.x) / 2, y: (s0.y + s2.y) / 2 };
      this.fishBread(mid.x - 6, mid.y - 1, '#e9a94b', 1.1);
      c.fillStyle = K.t1; c.font = '800 6px ui-sans-serif, system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('붕어빵', mid.x + 7, mid.y - 2.5);
      c.fillStyle = K.t2; c.fillText('3개 2천', mid.x + 7, mid.y + 3.5);
      // steam
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.45 + i / 3) % 1;
        const q = P(x + 0.9 + i * 0.2, y + 0.35, 0.95 + k * 0.8);
        c.globalAlpha = 0.5 * (1 - k);
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(q.x + Math.sin(t * 2 + i) * 2, q.y, 2.5 + k * 3, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }

    fishBread(x, y, col, s) {
      const c = this.ctx;
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = col; c.strokeStyle = '#8a5a26'; c.lineWidth = 0.7;
      c.beginPath(); c.ellipse(0, 0, 4.2, 2.3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(3.4, 0); c.lineTo(6.4, -2.2); c.lineTo(6.4, 2.2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5a3a1a'; c.fillRect(-2.6, -0.8, 0.9, 0.9);
      c.restore();
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
      if (this.plan.village) return this.toyDesk(dk, p);
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
      const PA = this.plan && this.plan.paper;
      const base = (PA ? { thinking: '#e4dcec', tool: '#d6e2ec', typing: '#dde9d6', waiting: '#f3e6c0', error: '#f2cdc6' } : { thinking: '#3a3160', tool: '#14324f', typing: '#123d2e', waiting: '#4d3510', error: '#4a1612' })[st] || this.pal.screenOff;
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
          c.strokeStyle = i % 3 === 0 ? col : PA ? 'rgba(112,88,74,.3)' : 'rgba(255,255,255,.55)';
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
      if (this.plan.village) return this.toyChair(dk, p);
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
        case 'dance': {
          const b = Math.sin(t * 6 + p.phase);
          img = b > 0 ? ch.left : ch.right;
          dy -= Math.abs(b) * 4; tilt = b * 0.14; break;
        }
        case 'stretch': {
          const k = (Math.sin(t * 1.6 + p.phase) + 1) / 2;
          sq = 1 + k * 0.1; tilt = Math.sin(t * 0.8 + p.phase) * 0.1; break;
        }
        case 'hop': dy -= Math.abs(Math.sin(t * 4.5 + p.phase)) * 9; sq = 1 + Math.sin(t * 9 + p.phase) * 0.04; break;
        case 'snack': dy -= Math.max(0, Math.sin(t * 7 + p.phase)) * 1.5; sq = 1 + Math.sin(t * 7 + p.phase) * 0.025; break;
        case 'weed': {
          // crouch, tug, pop up again
          const k = Math.max(0, Math.sin(t * 2.4 + p.phase));
          sq = 0.9 + (1 - k) * 0.06; dy += 2 - k * 3; tilt = Math.sin(t * 2.4 + p.phase) * 0.12; break;
        }
        case 'scroll': tilt = 0.1 + Math.sin(t * 0.7 + p.phase) * 0.03; break;
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
      if (XMAS) this.santaHat(-H + H * (img.topF || 0), W, t + p.phase);
      c.restore();
      if (s.status === 'error' && p.mode === 'work') {
        c.fillStyle = '#e04848'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
        c.fillText('!', x + W / 2, footY - H + 4);
      }
      const headTop = footY + dy - H + 6;
      if (!s.npc) this.hit.push({ key: p.key, x0: x - W / 2, x1: x + W / 2, y0: headTop - 22, y1: fb.y + 4 });
      return { x, y: headTop, act: st.act };
    }

    // The little "🎮 게임 중" caption over someone doing something.
    // Comes and goes so a busy office doesn't turn into a wall of text.
    caption(p, act, x, y) {
      if (p.path.length || !act) return null;
      const s = p.s || {};
      const key = act === 'type' && p.shift ? (p.charIdx === WORKAHOLIC ? 'grind' : 'shift') : act;
      const list = ACT_CAPTION[key];
      if (!list) return null;
      const t = this.t / 1000;
      const cyc = (t + p.phase * 4) % 11;
      if (cyc > 7.5) return null;
      const [icon, text] = list[Math.floor((p.capSeed || 0) * list.length) % list.length];
      const c = this.ctx;
      c.save();
      c.globalAlpha = Math.min(1, cyc * 2.5, (7.5 - cyc) * 2.5) * 0.62;
      c.textBaseline = 'middle';
      c.font = '600 9.5px ui-sans-serif, system-ui, -apple-system, sans-serif';
      const ICON = 12, tw = c.measureText(text).width;
      const w = 6 + ICON + 3 + tw + 7, h = 15, x0 = x - w / 2, yy = y - 7 - Math.abs(Math.sin(t * 1.6 + p.phase)) * 1;
      this.roundRect(x0, yy - h / 2, w, h, 7.5, 'rgba(255,250,244,.9)', null);
      c.strokeStyle = 'rgba(107,74,58,.22)'; c.lineWidth = 0.8; c.stroke();
      const ic = emojiIcon(icon);
      if (ic) {
        const k = 10.5 / Math.max(ic.w, ic.h), iw = ic.w * k, ih = ic.h * k;
        c.drawImage(ic.cv, ic.x, ic.y, ic.w, ic.h, x0 + 6 + (ICON - iw) / 2, yy - ih / 2, iw, ih);
      }
      c.textAlign = 'left';
      c.fillStyle = '#8f7a6d';
      c.fillText(text, x0 + 6 + ICON + 3, yy + 0.5);
      c.restore();
      return yy - h / 2 - 2;
    }

    bubble(p, at) {
      if (p.s && p.s.npc) { this.caption(p, at.act, at.x, at.y - 4); return; } // extras: no label, just what they're doing
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
        // The paper office keeps working states soft; only waiting/error stay loud.
        const PAPER_STATUS = { thinking: '#9a8fc0', tool: '#7f9fb8', typing: '#86a97f', waiting: STATUS_COLOR.waiting, error: STATUS_COLOR.error };
        const col = (this.plan.paper && PAPER_STATUS[st]) || STATUS_COLOR[st] || '#888';
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
        } else if (p.shift) {
          const ny = this.caption(p, at.act, x, y);
          if (ny != null) { top = ny; c.font = font(600, 10); }
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
        } else if (at.act && ACT_CAPTION[at.act]) {
          const ny = this.caption(p, at.act, x, y);
          if (ny != null) { top = ny; c.font = font(600, 10); }
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
      // A round, chibi cat in the paper style: big head, small body, pen line,
      // blush and a little ω mouth. Ginger, or calico with soft patches.
      const calico = k.coat === 'calico';
      const pen = 'rgba(112,88,74,.9)';
      const fur = calico ? '#fffaf2' : '#f2c48e', furD = calico ? '#f0b27a' : '#e3a66c';
      const purr = k.petBy && !walking ? Math.sin(t * 6) * 0.5 : 0;
      const step = walking ? Math.sin(t * 14) : 0;
      c.fillStyle = 'rgba(112,88,74,.14)';
      c.beginPath(); c.ellipse(0, 0, 9, 3.2, 0, 0, Math.PI * 2); c.fill();
      c.lineJoin = 'round'; c.lineCap = 'round';
      const outlined = (path, fill) => { path(); c.fillStyle = fill; c.fill(); c.strokeStyle = pen; c.lineWidth = 0.9; c.stroke(); };
      // tail: a fat curl, pen line under the fur colour
      const sway = k.petBy ? Math.sin(t * 8) * 3.5 : Math.sin(t * 2.6) * 2.5;
      const tail = () => { c.beginPath(); c.moveTo(-5, walking ? -6 : -3); c.quadraticCurveTo(-12, -6 + sway * 0.4, -11 + sway * 0.3, -13); c.quadraticCurveTo(-10.5 + sway * 0.3, -15.5, -8.5 + sway * 0.3, -14); };
      tail(); c.strokeStyle = pen; c.lineWidth = 4.2; c.stroke();
      tail(); c.strokeStyle = calico ? '#8c7a6e' : furD; c.lineWidth = 2.6; c.stroke();
      // legs
      const legs = walking ? [[-4, step], [-1.5, -step], [2.5, -step], [5, step]] : [[-1.5, 0], [3.5, 0]];
      for (const [lx, s2] of legs) outlined(() => { c.beginPath(); c.ellipse(lx, -1.2 + s2 * 0.6, 1.6, 1.8, 0, 0, Math.PI * 2); }, fur);
      // body
      const bx = walking ? 0 : 0.5, by = walking ? -5.5 : -6 + purr * 0.3;
      const body = () => { c.beginPath(); c.ellipse(bx, by, walking ? 7.5 : 6.2, walking ? 4.6 : 5.6, 0, 0, Math.PI * 2); };
      outlined(body, fur);
      c.save(); body(); c.clip();
      if (calico) {
        c.fillStyle = '#f0b27a'; c.beginPath(); c.ellipse(bx - 3.5, by - 2.5, 3.8, 3, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#8c7a6e'; c.beginPath(); c.ellipse(bx + 2.5, by - 3.6, 2.8, 2.2, -0.2, 0, Math.PI * 2); c.fill();
      } else {
        c.strokeStyle = 'rgba(214,150,90,.75)'; c.lineWidth = 1.2;
        for (const sx of [-3, 0, 3]) { c.beginPath(); c.moveTo(bx + sx - 1, by - 5.5); c.quadraticCurveTo(bx + sx, by - 3.5, bx + sx - 0.5, by - 2); c.stroke(); }
      }
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(bx + 1, by + 2, 3.5, 2, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      body(); c.strokeStyle = pen; c.lineWidth = 0.9; c.stroke();
      // head
      const hx = walking ? 6.5 : 4.2, hy = walking ? -10.5 : -13.2 + purr * 0.4, R = 5.2;
      const ear = (ex, dir, col) => outlined(() => { c.beginPath(); c.moveTo(hx + ex - 2.4 * dir, hy - R * 0.55); c.quadraticCurveTo(hx + ex - 0.4 * dir, hy - R - 2.8, hx + ex + 0.6 * dir, hy - R - 2.5); c.quadraticCurveTo(hx + ex + 1.6 * dir, hy - R * 0.9, hx + ex + 2.2 * dir, hy - R * 0.5); c.closePath(); }, col);
      ear(-2.4, 1, calico ? '#8c7a6e' : fur);
      ear(2.6, -1, calico ? '#f0b27a' : fur);
      c.fillStyle = '#f2c4bc';
      c.beginPath(); c.ellipse(hx - 2.2, hy - R + 0.2, 0.8, 1.3, 0.2, 0, Math.PI * 2); c.ellipse(hx + 2.4, hy - R + 0.2, 0.8, 1.3, -0.2, 0, Math.PI * 2); c.fill();
      const head = () => { c.beginPath(); c.ellipse(hx, hy, R, R * 0.9, 0, 0, Math.PI * 2); };
      outlined(head, fur);
      if (calico) {
        c.save(); head(); c.clip();
        c.fillStyle = '#8c7a6e'; c.beginPath(); c.arc(hx - 3.2, hy - 3, 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f0b27a'; c.beginPath(); c.arc(hx + 3.6, hy - 3.2, 2.8, 0, Math.PI * 2); c.fill();
        c.restore(); head(); c.strokeStyle = pen; c.lineWidth = 0.9; c.stroke();
      } else {
        c.strokeStyle = 'rgba(214,150,90,.8)'; c.lineWidth = 1;
        for (const sx of [-1.2, 0.6]) { c.beginPath(); c.moveTo(hx + sx, hy - R * 0.85); c.lineTo(hx + sx + 0.3, hy - R * 0.45); c.stroke(); }
      }
      // face (looking the way it faces)
      const fx = hx + 0.8, fy = hy + 0.6;
      c.fillStyle = '#5e4a3e'; c.strokeStyle = '#5e4a3e';
      if (k.petBy && !walking) {
        c.lineWidth = 0.9;
        for (const ex of [-1.9, 1.9]) { c.beginPath(); c.moveTo(fx + ex - 0.9, fy - 0.2); c.quadraticCurveTo(fx + ex, fy - 1.4, fx + ex + 0.9, fy - 0.2); c.stroke(); }
      } else {
        const blink = (t + k.x) % 4 < 0.12;
        for (const ex of [-1.9, 1.9]) { c.beginPath(); c.ellipse(fx + ex, fy - 0.6, 0.85, blink ? 0.2 : 1.05, 0, 0, Math.PI * 2); c.fill(); }
        if (!blink) { c.fillStyle = '#fff'; for (const ex of [-1.9, 1.9]) { c.beginPath(); c.arc(fx + ex + 0.3, fy - 1, 0.32, 0, Math.PI * 2); c.fill(); } }
      }
      c.fillStyle = 'rgba(240,160,150,.55)';
      c.beginPath(); c.ellipse(fx - 3.3, fy + 0.9, 1.3, 0.8, 0, 0, Math.PI * 2); c.ellipse(fx + 3.3, fy + 0.9, 1.3, 0.8, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#5e4a3e'; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(fx - 1, fy + 0.6); c.quadraticCurveTo(fx - 0.5, fy + 1.4, fx, fy + 0.7); c.quadraticCurveTo(fx + 0.5, fy + 1.4, fx + 1, fy + 0.6); c.stroke();
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
          c.fillText('💗', p.x + (i ? 4 : -3) + Math.sin(t * 3 + i) * 2, p.y - (FLOATWIN ? 32 : 22) - f * 14);
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
