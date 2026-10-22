// Canvas drawing: terrain, grid, buildings, items, overlays.
import { DX, DY, BELT_SPEED, BELT_TICKS, CYCLE, HOLD_SECONDS, inB, isMachine, tunnelPartner, recipeOf, heldSeconds, RECIPES } from './sim.js';
import { PLURAL } from './levels.js';

export const HOLD_MS = 450;

export function createRenderer(cv, floorEl, game) {
  const ctx = cv.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const C = {};
  ['bg', 'floor', 'panel', 'line', 'fg', 'muted', 'accent', 'ok', 'warn', 'bad', 'ore', 'plate', 'gear', 'belt']
    .forEach(k => (C[k] = css.getPropertyValue('--' + k).trim()));
  const DISPLAY = css.getPropertyValue('--display').trim();
  const MONO = css.getPropertyValue('--mono').trim();

  const r = { S: 40, dpr: 1 };
  let animT = 0;

  // ---------- effects (M5) ----------
  // Effects run on real time, so a building still pops in while the game is paused. None of this
  // touches the simulation: it only watches the grid and the hub deliveries.
  const motionOK = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let fx = [];                    // { kind, t0, dur, ... }
  const firstSeen = new WeakMap(); // cell → time it first appeared (pop-in)
  const lastCraft = new WeakMap(); // cell → { n: last completion tick, t: time of the pulse }
  let prevGrid = null, before = null, quiet = true, hubBump = -1e9;
  r.resetFx = () => { fx = []; prevGrid = null; quiet = true; hubBump = -1e9; };
  const easeBack = p => { const c = 1.7; p -= 1; return 1 + (c + 1) * p * p * p + c * p * p; };
  r.delivered = (item, fx0, fy0, tx, ty) => {
    if (!motionOK() || fx.length > 120) return;
    fx.push({ kind: 'sink', item, x: (fx0 + tx) / 2 + 0.5, y: (fy0 + ty) / 2 + 0.5, dx: tx - fx0, dy: ty - fy0, t0: performance.now(), dur: 320 });
    hubBump = performance.now();
  };
  r.celebrate = () => {
    if (!motionOK()) return;
    const hb = game.level.hub, cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2, now = performance.now();
    const cols = [C.accent, C.ok, C.gear, C.plate, '#e8a862'];
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2, v = 2.5 + Math.random() * 4.5;
      fx.push({ kind: 'spark', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5, col: cols[i % cols.length], spin: Math.random() * 6, t0: now, dur: 900 + Math.random() * 500 });
    }
    fx.push({ kind: 'flash', t0: now, dur: 700 });
  };
  function popScale(c, x, y, now) {
    let t = firstSeen.get(c);
    if (t == null) {
      // a tile that held the same building last frame (undo rebuilds every cell) doesn't pop
      const same = before && before[y] && before[y][x] && before[y][x].t === c.t;
      t = quiet || same || !motionOK() ? -1e9 : now;
      firstSeen.set(c, t);
    }
    const p = (now - t) / 220;
    return p >= 1 ? 1 : 0.4 + 0.6 * easeBack(Math.max(0, p));
  }
  function craftScale(c, now) {
    if (!isMachine(c.t) || !c.done.length) return 1;
    const n = c.done[c.done.length - 1];
    let k = lastCraft.get(c);
    if (!k) { lastCraft.set(c, { n, t: -1e9 }); return 1; }
    if (k.n !== n) { k.n = n; k.t = motionOK() ? now : -1e9; }
    const p = (now - k.t) / 240;
    return p >= 1 ? 1 : 1 + 0.12 * Math.sin(p * Math.PI);
  }
  const PUFF_COL = { belt: '#5d6872', tin: '#5d6872', tout: '#5d6872', cross: '#6b7680', split: '#a49cd6', miner: '#8a949b', furnace: '#f08a3a', assembler: '#7d8c94' };
  function watchRemovals(now) {
    const { W, H, grid } = game;
    before = prevGrid;
    if (prevGrid && prevGrid.length === H && prevGrid[0].length === W && !quiet && motionOK()) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const was = prevGrid[y][x];
        if (was && !grid[y][x]) fx.push({ kind: 'puff', x: x + 0.5, y: y + 0.5, col: PUFF_COL[was.t] || C.muted, t0: now, dur: 300 });
      }
    }
    prevGrid = grid.map(row => row.slice());
  }

  function fit() {
    const b = floorEl.getBoundingClientRect();
    r.S = Math.max(20, Math.floor(Math.min(b.width / game.W, b.height / game.H)));
    r.dpr = window.devicePixelRatio || 1;
    cv.style.width = game.W * r.S + 'px';
    cv.style.height = game.H * r.S + 'px';
    cv.width = game.W * r.S * r.dpr;
    cv.height = game.H * r.S * r.dpr;
  }
  new ResizeObserver(fit).observe(floorEl);
  fit();
  r.fit = fit;

  r.tileAt = e => {
    const b = cv.getBoundingClientRect();
    const fx = (e.clientX - b.left) / r.S, fy = (e.clientY - b.top) / r.S;
    return { fx, fy, x: Math.floor(fx), y: Math.floor(fy) };
  };

  function rr(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, rad) : ctx.rect(x, y, w, h);
  }

  function drawGear(cx, cy, rad, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr2 = i % 2 ? rad : rad * 1.3;
      ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.panel;
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.38, 0, 7); ctx.fill();
  }

  // Item colours, also used for the little input gauges on machines.
  const ITEM_COL = { ore: C.ore, plate: C.plate, gear: C.gear, 'cu-ore': '#4fa58f', 'cu-plate': '#d6844f', wire: '#e8a862', circuit: '#3fae5a' };

  function nugget(x, y, rad, fill, edge) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x - rad, y); ctx.lineTo(x - rad * 0.3, y - rad); ctx.lineTo(x + rad, y - rad * 0.4);
    ctx.lineTo(x + rad * 0.7, y + rad); ctx.lineTo(x - rad * 0.5, y + rad * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawItem(item, x, y, scale = 1) {
    const S = r.S, rad = S * 0.13 * scale;
    if (item === 'ore') nugget(x, y, rad, C.ore, '#a8694a');
    else if (item === 'cu-ore') nugget(x, y, rad, ITEM_COL['cu-ore'], '#7fd0bc');
    else if (item === 'plate' || item === 'cu-plate') {
      ctx.fillStyle = ITEM_COL[item]; rr(x - rad, y - rad * 0.75, rad * 2, rad * 1.5, 2); ctx.fill();
    } else if (item === 'wire') {
      ctx.strokeStyle = ITEM_COL.wire; ctx.lineWidth = Math.max(1.2, rad * 0.35); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 4, rx = x - rad + (i / 12) * rad * 2;
        ctx.lineTo(rx, y + Math.sin(a) * rad * 0.55);
      }
      ctx.stroke();
    } else if (item === 'circuit') {
      ctx.fillStyle = ITEM_COL.circuit; rr(x - rad, y - rad, rad * 2, rad * 2, rad * 0.3); ctx.fill();
      ctx.fillStyle = '#e8c35a';
      for (const [dx, dy] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        ctx.beginPath(); ctx.arc(x + dx * rad, y + dy * rad, rad * 0.16, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#1e5a2e'; rr(x - rad * 0.3, y - rad * 0.3, rad * 0.6, rad * 0.6, 1); ctx.fill();
    } else {
      drawGear(x, y, rad * 0.85, C.gear);
    }
  }

  // A strip of belt running "up" in the current (rotated) frame, from y0 down to y1.
  function beltStrip(y0, y1, chevrons = true) {
    const S = r.S;
    ctx.fillStyle = C.belt; ctx.fillRect(-S * 0.32, y0, S * 0.64, y1 - y0);
    ctx.strokeStyle = '#48525b'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-S * 0.32, y0); ctx.lineTo(-S * 0.32, y1);
    ctx.moveTo(S * 0.32, y0); ctx.lineTo(S * 0.32, y1);
    ctx.stroke();
    if (!chevrons) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(-S * 0.32, y0, S * 0.64, y1 - y0); ctx.clip();
    ctx.strokeStyle = '#5d6872'; ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ph = (animT * BELT_SPEED) % 1;
    for (let k = 0; k < 2; k++) {
      const yy = S * 0.5 - (((k * 0.5) + ph) % 1) * S + S * 0.08;
      ctx.beginPath();
      ctx.moveTo(-S * 0.15, yy + S * 0.08); ctx.lineTo(0, yy - S * 0.06); ctx.lineTo(S * 0.15, yy + S * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Tunnel mouth: a dark arch filling the top half (entrance) or bottom half (exit) of the tile.
  function tunnelMouth(top) {
    const S = r.S, y = top ? -S * 0.46 : 0, h = S * 0.46;
    ctx.fillStyle = '#3d4750'; rr(-S * 0.42, y, S * 0.84, h, S * 0.1); ctx.fill();
    ctx.fillStyle = '#0e1113';
    ctx.beginPath();
    if (top) { ctx.moveTo(-S * 0.26, 0); ctx.lineTo(-S * 0.26, -S * 0.18); ctx.arc(0, -S * 0.18, S * 0.26, Math.PI, 0); ctx.lineTo(S * 0.26, 0); }
    else { ctx.moveTo(-S * 0.26, 0); ctx.lineTo(-S * 0.26, S * 0.18); ctx.arc(0, S * 0.18, S * 0.26, Math.PI, 0, true); ctx.lineTo(S * 0.26, 0); }
    ctx.closePath(); ctx.fill();
  }

  function drawBuilding(t, d, px, py, c, alpha, scale = 1) {
    const S = r.S;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px + S / 2, py + S / 2);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.rotate((d * Math.PI) / 2);
    if (t === 'belt') {
      beltStrip(-S * 0.5, S * 0.5);
    } else if (t === 'tin') {
      beltStrip(0, S * 0.5);
      tunnelMouth(true);
    } else if (t === 'tout') {
      beltStrip(-S * 0.5, 0);
      tunnelMouth(false);
    } else if (t === 'cross') {
      beltStrip(-S * 0.5, S * 0.5, false);
      ctx.rotate(Math.PI / 2);
      beltStrip(-S * 0.5, S * 0.5, false);
      ctx.fillStyle = '#48525b'; rr(-S * 0.2, -S * 0.2, S * 0.4, S * 0.4, S * 0.06); ctx.fill();
      ctx.strokeStyle = '#6b7680'; ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-S * 0.1, 0); ctx.lineTo(S * 0.1, 0); ctx.moveTo(0, -S * 0.1); ctx.lineTo(0, S * 0.1); ctx.stroke();
    } else if (t === 'split') {
      ctx.fillStyle = '#3d3a52'; rr(-S * 0.36, -S * 0.36, S * 0.72, S * 0.72, S * 0.14); ctx.fill();
      ctx.strokeStyle = '#655f86'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#a49cd6';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.moveTo(-S * 0.1, -S * 0.3); ctx.lineTo(0, -S * 0.45); ctx.lineTo(S * 0.1, -S * 0.3); ctx.closePath(); ctx.fill();
        ctx.rotate(Math.PI / 2);
      }
      ctx.fillStyle = '#26243a'; ctx.beginPath(); ctx.arc(0, 0, S * 0.13, 0, 7); ctx.fill();
    } else {
      const body = { miner: '#3a4650', furnace: '#4a3b33', assembler: '#33434a' }[t];
      ctx.fillStyle = body; rr(-S * 0.42, -S * 0.42, S * 0.84, S * 0.84, S * 0.12); ctx.fill();
      ctx.strokeStyle = '#5b6670'; ctx.lineWidth = 1; ctx.stroke();
      // output notch
      ctx.fillStyle = C.accent;
      ctx.beginPath(); ctx.moveTo(-S * 0.12, -S * 0.38); ctx.lineTo(0, -S * 0.52); ctx.lineTo(S * 0.12, -S * 0.38); ctx.closePath(); ctx.fill();
      const busy = c && c.busy;
      if (t === 'miner') {
        // the drill bobs while it works
        if (busy) ctx.translate(0, Math.sin(animT * 14) * S * 0.035);
        ctx.fillStyle = busy ? '#c9d1d6' : '#8a949b';
        ctx.beginPath(); ctx.moveTo(-S * 0.15, S * 0.2); ctx.lineTo(0, -S * 0.2); ctx.lineTo(S * 0.15, S * 0.2); ctx.closePath(); ctx.fill();
      } else if (t === 'furnace') {
        ctx.fillStyle = busy ? '#f08a3a' : '#2a211d';
        ctx.beginPath(); ctx.arc(0, S * 0.04, S * 0.17, 0, 7); ctx.fill();
        if (busy) {
          // the fire flickers
          const f = 0.18 + 0.1 * (Math.sin(animT * 11) * 0.6 + Math.sin(animT * 17.3) * 0.4);
          ctx.fillStyle = `rgba(240,162,58,${f.toFixed(3)})`; ctx.beginPath(); ctx.arc(0, S * 0.04, S * (0.25 + f * 0.12), 0, 7); ctx.fill();
        }
      } else if (!c || !c.recipe || c.recipe === 'gear') {
        ctx.rotate(busy ? animT * 2 : 0);
        drawGear(0, 0, S * 0.15, busy ? C.gear : '#7d6a45');
      } else {
        // other recipes show what they make, upright whichever way the machine faces
        ctx.rotate((-d * Math.PI) / 2);
        ctx.globalAlpha = alpha * (busy ? 1 : 0.6);
        drawItem(RECIPES[c.recipe].out, 0, 0, 1.25);
      }
    }
    ctx.restore();
    if (c && c.done && isMachine(t)) {
      // status pip
      ctx.fillStyle = c.status === 'working' ? C.ok : c.status === 'blocked' ? C.bad : C.warn;
      ctx.beginPath(); ctx.arc(px + S * 0.2, py + S * 0.2, S * 0.065, 0, 7); ctx.fill();
      // progress
      if (c.busy) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px + S * 0.18, py + S * 0.78, S * 0.64, S * 0.05);
        ctx.fillStyle = C.ok; ctx.fillRect(px + S * 0.18, py + S * 0.78, S * 0.64 * Math.min(1, c.timer / CYCLE), S * 0.05);
      }
      // queued inputs: one row of ticks per ingredient, top right
      let row = 0;
      for (const item of Object.keys(recipeOf(c).in)) {
        ctx.fillStyle = ITEM_COL[item];
        const n = c.inv[item] || 0;
        for (let i = 0; i < n; i++) ctx.fillRect(px + S * 0.8 - i * S * 0.07, py + S * (0.12 + row * 0.12), S * 0.045, S * 0.08);
        row++;
      }
    }
  }

  r.draw = (dtAnim, g) => {
    animT += dtAnim;
    const now = performance.now();
    watchRemovals(now);
    const S = r.S, { W, H, terrain, grid, level } = game;
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.fillStyle = C.floor; ctx.fillRect(0, 0, W * S, H * S);
    // terrain
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tr = terrain[y][x], px = x * S, py = y * S;
      if (tr === 'ore') {
        ctx.fillStyle = '#2a2320'; ctx.fillRect(px, py, S, S);
        ctx.fillStyle = C.ore;
        for (let i = 0; i < 4; i++) {
          const h = (x * 73 + y * 151 + i * 97) % 100;
          ctx.beginPath(); ctx.arc(px + S * (0.18 + (h % 7) / 10), py + S * (0.18 + ((h >> 2) % 7) / 10), S * 0.055, 0, 7); ctx.fill();
        }
      } else if (tr === 'copper') {
        ctx.fillStyle = '#1b2826'; ctx.fillRect(px, py, S, S);
        ctx.fillStyle = ITEM_COL['cu-ore'];
        for (let i = 0; i < 4; i++) {
          const h = (x * 61 + y * 137 + i * 89) % 100;
          ctx.beginPath(); ctx.arc(px + S * (0.18 + (h % 7) / 10), py + S * (0.18 + ((h >> 2) % 7) / 10), S * 0.055, 0, 7); ctx.fill();
        }
      } else if (tr === 'rock') {
        ctx.fillStyle = '#2e3438'; rr(px + S * 0.1, py + S * 0.12, S * 0.8, S * 0.76, S * 0.25); ctx.fill();
        ctx.fillStyle = '#3a4146'; rr(px + S * 0.22, py + S * 0.2, S * 0.4, S * 0.28, S * 0.12); ctx.fill();
      }
    }
    // grid lines
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < W; x++) { ctx.moveTo(x * S + 0.5, 0); ctx.lineTo(x * S + 0.5, H * S); }
    for (let y = 1; y < H; y++) { ctx.moveTo(0, y * S + 0.5); ctx.lineTo(W * S, y * S + 0.5); }
    ctx.stroke();
    // hub
    const hb = level.hub, hx = hb.x * S, hy = hb.y * S, hcx = hx + (hb.w * S) / 2, hcy = hy + (hb.h * S) / 2;
    ctx.fillStyle = C.panel; rr(hx + 3, hy + 3, hb.w * S - 6, hb.h * S - 6, 8); ctx.fill();
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
    // hold timer: a ring that fills round the hub while the target is being held
    const held = heldSeconds(game), won = game.wonSinceChange;
    if (held > 0 || won) {
      const per = 2 * (hb.w * S - 6 + hb.h * S - 6), p = won ? 1 : Math.min(1, held / HOLD_SECONDS);
      ctx.save();
      ctx.strokeStyle = won ? C.ok : '#ffd08a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.setLineDash([per * p, per]);
      rr(hx + 3, hy + 3, hb.w * S - 6, hb.h * S - 6, 8); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = C.accent; ctx.font = `700 ${Math.round(S * 0.42)}px ${DISPLAY}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('HUB', hcx, hcy - S * 0.2);
    // the count bumps up a little with each delivery
    const bp = (now - hubBump) / 260, bump = bp < 1 ? 1 + 0.18 * Math.sin(bp * Math.PI) : 1;
    ctx.save();
    ctx.translate(hcx, hcy + S * 0.3); ctx.scale(bump, bump);
    ctx.fillStyle = bp < 1 ? C.fg : C.muted; ctx.font = `500 ${Math.round(S * 0.24)}px ${MONO}`;
    ctx.fillText(`${game.hubTotal} ${PLURAL[level.target.item]}`, 0, 0);
    ctx.restore();
    // tunnel pairings: a faint dashed line between the two ends
    ctx.save();
    ctx.strokeStyle = 'rgba(160,172,182,.35)'; ctx.lineWidth = Math.max(1.5, S * 0.04); ctx.setLineDash([S * 0.12, S * 0.12]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (!c || c.t !== 'tin') continue;
      const [ex, ey] = tunnelPartner(c, x, y);
      ctx.beginPath();
      ctx.moveTo(x * S + S / 2 + DX[c.d] * S * 0.4, y * S + S / 2 + DY[c.d] * S * 0.4);
      ctx.lineTo(ex * S + S / 2 - DX[c.d] * S * 0.4, ey * S + S / 2 - DY[c.d] * S * 0.4);
      ctx.stroke();
    }
    ctx.restore();
    // buildings
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (c) drawBuilding(c.t, c.d, x * S, y * S, c, 1, popScale(c, x, y, now) * craftScale(c, now));
    }
    quiet = false;
    // items in transit
    const along = (x, y, dir, prog, item) => {
      const o = (prog / BELT_TICKS - 0.5) * S;
      drawItem(item, x * S + S / 2 + DX[dir] * o, y * S + S / 2 + DY[dir] * o);
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (!c) continue;
      if ((c.t === 'belt' || c.t === 'tout') && c.item) along(x, y, c.d, c.prog, c.item);
      else if (c.t === 'tin') { for (const it of c.q) if (it.prog < BELT_TICKS * 0.6) along(x, y, c.d, it.prog, it.item); }
      else if (c.t === 'cross') { for (const l of c.lanes) if (l) along(x, y, l.dir, l.prog, l.item); }
      else if (c.t === 'split' && c.item) {
        const k = 0.5 * (1 - Math.min(1, c.prog / BELT_TICKS)) * S;
        drawItem(c.item, x * S + S / 2 + DX[c.from] * k, y * S + S / 2 + DY[c.from] * k);
      }
    }
    // effects: items sinking into the hub, removal puffs, win sparks
    fx = fx.filter(f => now - f.t0 < f.dur);
    for (const f of fx) {
      const p = Math.max(0, (now - f.t0) / f.dur);
      if (f.kind === 'sink') {
        ctx.save(); ctx.globalAlpha = 1 - p;
        drawItem(f.item, (f.x + f.dx * p * 0.6) * S, (f.y + f.dy * p * 0.6) * S, 1 - p * 0.7);
        ctx.restore();
      } else if (f.kind === 'puff') {
        ctx.save(); ctx.globalAlpha = 0.8 * (1 - p); ctx.fillStyle = f.col;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.4, d = S * (0.12 + p * 0.38);
          ctx.beginPath(); ctx.arc(f.x * S + Math.cos(a) * d, f.y * S + Math.sin(a) * d, S * 0.07 * (1 - p * 0.6), 0, 7); ctx.fill();
        }
        ctx.restore();
      } else if (f.kind === 'spark') {
        const t = (now - f.t0) / 1000, x = (f.x + f.vx * t) * S, y = (f.y + f.vy * t + 4.5 * t * t) * S;
        ctx.save(); ctx.globalAlpha = 1 - p * p; ctx.fillStyle = f.col;
        ctx.translate(x, y); ctx.rotate(f.spin + t * 8);
        ctx.fillRect(-S * 0.06, -S * 0.03, S * 0.12, S * 0.06);
        ctx.restore();
      } else if (f.kind === 'flash') {
        ctx.save(); ctx.globalAlpha = 0.5 * (1 - p); ctx.strokeStyle = C.ok; ctx.lineWidth = 3 + p * 10;
        const g2 = p * S * 0.6;
        rr(hx + 3 - g2, hy + 3 - g2, hb.w * S - 6 + g2 * 2, hb.h * S - 6 + g2 * 2, 8 + g2); ctx.stroke();
        ctx.restore();
      }
    }
    // selected building (tapped to inspect)
    const sel = r.selected && r.selected();
    if (sel && grid[sel.y] && grid[sel.y][sel.x]) {
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.setLineDash([S * 0.1, S * 0.08]);
      rr(sel.x * S + 2, sel.y * S + 2, S - 4, S - 4, 6); ctx.stroke(); ctx.setLineDash([]);
    }
    // gesture overlays
    if (g) {
      if (g.tunnel && g.end) {
        const { x: ax, y: ay } = g, { x: bx, y: by } = g.end;
        const d = bx > ax ? 1 : bx < ax ? 3 : by > ay ? 2 : 0;
        drawBuilding('tin', d, ax * S, ay * S, null, 0.65);
        drawBuilding('tout', d, bx * S, by * S, null, 0.65);
        ctx.strokeStyle = g.tunnelWhy ? C.bad : C.accent; ctx.lineWidth = 2.5;
        rr(ax * S + 2, ay * S + 2, S - 4, S - 4, 6); ctx.stroke();
        rr(bx * S + 2, by * S + 2, S - 4, S - 4, 6); ctx.stroke();
        ctx.save(); ctx.setLineDash([S * 0.12, S * 0.12]); ctx.beginPath();
        ctx.moveTo(ax * S + S / 2, ay * S + S / 2); ctx.lineTo(bx * S + S / 2, by * S + S / 2); ctx.stroke(); ctx.restore();
      }
      if (g.ghost) {
        drawBuilding(g.tool, g.dir, g.x * S, g.y * S, g.tool === 'assembler' ? { recipe: g.recipe, inv: {}, status: '' } : null, 0.6);
        ctx.strokeStyle = g.ghostBad ? C.bad : C.accent; ctx.lineWidth = 2.5;
        rr(g.x * S + 2, g.y * S + 2, S - 4, S - 4, 6); ctx.stroke();
      }
      if (g.hold && !g.moved && !g.held) {
        const p = Math.min(1, (performance.now() - g.t0) / HOLD_MS);
        if (p > 0.15) {
          ctx.strokeStyle = C.bad; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(g.x * S + S / 2, g.y * S + S / 2, S * 0.46, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
        }
      }
      if (g.cur && inB(game, g.cur.x, g.cur.y) && !g.ghost) {
        ctx.strokeStyle = 'rgba(240,162,58,.7)'; ctx.lineWidth = 2;
        rr(g.cur.x * S + 2, g.cur.y * S + 2, S - 4, S - 4, 6); ctx.stroke();
      }
    }
  };

  return r;
}
