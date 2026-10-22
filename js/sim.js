// Grid state, fixed-step tick, belts and logistics, machines, hub delivery, rates and win detection.
// Everything runs on whole ticks (20 per second) so the same layout always gives the same result.
import { buildTerrain } from './levels.js';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIRNAME = ['up', 'right', 'down', 'left'];
export const NAME = {
  belt: 'Belt', miner: 'Miner', furnace: 'Furnace', assembler: 'Assembler',
  tin: 'Tunnel entrance', tout: 'Tunnel exit', cross: 'Crossing', split: 'Splitter',
};
export const MACHINES = ['miner', 'furnace', 'assembler'];
export const isMachine = t => MACHINES.includes(t);

export const TPS = 20;            // ticks per second
export const STEP = 1 / TPS;      // seconds per tick
export const BELT_TICKS = 8;      // ticks for an item to cross one belt tile (2.5 tiles per second)
export const BELT_SPEED = TPS / BELT_TICKS;
export const TUNNEL_MAX = 5;      // entrance to exit: at most 4 tiles underground in between

// Items: ore and plate are iron (their ids predate copper); cu-ore and cu-plate are copper.
// Every machine works in 40-tick (2-second) cycles. An assembler's recipe is chosen per machine.
export const RECIPES = {
  gear: { in: { plate: 2 }, out: 'gear', n: 1 },
  wire: { in: { 'cu-plate': 1 }, out: 'wire', n: 2 },
  circuit: { in: { plate: 1, wire: 2 }, out: 'circuit', n: 1 },
};
export const SMELT = { ore: 'plate', 'cu-ore': 'cu-plate' };   // furnace: ore in → plate out
export const MINED = { ore: 'ore', copper: 'cu-ore' };         // terrain → what a miner digs
export const CYCLE = 40;
const FURNACE_CAP = 4;

// What a machine needs and makes right now: { in: { item: count }, out, n, cap(item) }.
export function recipeOf(c, terrainAt) {
  if (c.t === 'miner') return { in: {}, out: c.mines || 'ore', n: 1 };
  if (c.t === 'furnace') {
    const ore = c.ore || 'ore';
    return { in: { [ore]: 1 }, out: SMELT[ore], n: 1 };
  }
  return RECIPES[c.recipe || 'gear'];
}
const capFor = (r, item) => r.in[item] * 3;

// Win rule: once a target item reaches the hub after the last layout change, a hold timer starts.
// The line must keep up the target rate until the timer reaches HOLD. While it runs, deliveries
// are counted over a sliding CHECK window (or since the timer started, if that's shorter); a
// shortfall restarts the timer at the next delivery. Target rates must be even, so a CHECK
// window holds a whole number of items.
export const WINDOW_TICKS = 60 * TPS;   // rate readout window
export const CHECK_TICKS = 30 * TPS;
export const HOLD_TICKS = 45 * TPS;
export const HOLD_SECONDS = HOLD_TICKS / TPS;
const MACHINE_WINDOW = 30 * TPS;        // window for a tapped machine's rates

export const WHY = {
  off: 'That is off the floor.',
  rock: 'Rock is in the way.',
  hub: 'That is the hub.',
  noore: 'Miners need to sit on ore.',
  busy: 'Something is already there.',
};

// A grid cell. Fields used depend on the type (extra is a tunnel's length or an assembler's recipe):
//   belt, tout: item, prog            tin: q (items underground, each { item, prog })
//   cross: lanes[0] vertical, lanes[1] horizontal, each { item, prog, dir } or null
//   split: item, prog, from (side it came in), rr (last side used)
//   machines: inv (items waiting, by kind), out (finished items waiting to leave), busy, timer,
//     status, done (completion ticks), born; furnace: ore (the ore it is locked to while it has any);
//     assembler: recipe; miner: mines (set from the terrain each tick)
//   tin/tout: len = tiles from entrance to exit
export function cell(t, d, extra, born = 0) {
  const c = { t, d, item: null, prog: 0, inv: {}, out: 0, busy: false, timer: 0, status: 'starved', done: [], born };
  if (t === 'tin' || t === 'tout') c.len = extra;
  if (t === 'assembler') c.recipe = extra || 'gear';
  if (t === 'tin') c.q = [];
  if (t === 'cross') c.lanes = [null, null];
  if (t === 'split') { c.from = -1; c.rr = 3; }
  return c;
}

export function createGame(level) {
  const game = { running: true, speed: 1, onChange: () => {}, onWin: () => {}, onDeliver: () => {} };
  setLevel(game, level);
  return game;
}

// Switch the game to a level: fresh terrain, starter layout, clean counters and undo history.
export function setLevel(game, level) {
  game.level = level;
  game.W = level.w;
  game.H = level.h;
  game.terrain = buildTerrain(level);
  game.undo = [];
  game.gestureSnap = false;
  game.tick = 0;
  loadStarter(game);
  resetCounters(game);
}

function resetCounters(game) {
  game.tick = 0;
  game.deliveries = [];
  game.hubTotal = 0;
  game.changeTick = 0;
  game.holdStart = -1;      // tick the hold timer started, or -1
  game.shortTick = -1e9;    // tick the line last fell short
  game.wonSinceChange = false;
}

export function emptyGrid(game) {
  return Array.from({ length: game.H }, () => Array(game.W).fill(null));
}

export function loadStarter(game) {
  game.grid = emptyGrid(game);
  for (const [x, y, t, d, len] of game.level.starter || []) game.grid[y][x] = cell(t, d, len, game.tick);
}

// Layouts are saved as rows of [type, dir] or null; tunnel ends add their length and
// assemblers making anything but gears add their recipe.
export function layout(game) {
  return game.grid.map(r => r.map(c => {
    if (!c) return null;
    if (c.len) return [c.t, c.d, c.len];
    if (c.t === 'assembler' && c.recipe !== 'gear') return [c.t, c.d, c.recipe];
    return [c.t, c.d];
  }));
}

// Change an assembler's recipe; anything it was holding is lost.
export function setRecipe(c, recipe) {
  c.recipe = recipe; c.inv = {}; c.out = 0; c.busy = false; c.timer = 0;
}

export function loadLayout(game, l) {
  game.grid = l.map(r => r.map(v => (v ? cell(v[0], v[1], v[2], game.tick) : null)));
}

export const inB = (game, x, y) => x >= 0 && y >= 0 && x < game.W && y < game.H;
const dirOf = (dx, dy) => (dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3);

export function canPlace(game, x, y, t) {
  if (!inB(game, x, y)) return 'off';
  const tr = game.terrain[y][x];
  if (tr === 'rock') return 'rock';
  if (tr === 'hub') return 'hub';
  if (t === 'miner' && !MINED[tr]) return 'noore';
  return '';
}

// The other end of a tunnel, as [x, y].
export function tunnelPartner(c, x, y) {
  const s = c.t === 'tin' ? 1 : -1;
  return [x + DX[c.d] * c.len * s, y + DY[c.d] * c.len * s];
}

// Can a tunnel run from (ax, ay) to (bx, by)? Returns '' or a WHY key / message.
export function tunnelProblem(game, ax, ay, bx, by) {
  if (ax !== bx && ay !== by) return 'Tunnels run in a straight line.';
  const len = Math.abs(bx - ax) + Math.abs(by - ay);
  if (len < 2) return 'Drag at least two tiles to make a tunnel.';
  if (len > TUNNEL_MAX) return `Tunnels reach at most ${TUNNEL_MAX - 1} tiles underground.`;
  for (const [x, y] of [[ax, ay], [bx, by]]) {
    const why = canPlace(game, x, y, 'tin');
    if (why) return WHY[why];
    if (game.grid[y][x]) return WHY.busy;
  }
  return '';
}

export function placeTunnel(game, ax, ay, bx, by) {
  const d = dirOf(Math.sign(bx - ax), Math.sign(by - ay));
  const len = Math.abs(bx - ax) + Math.abs(by - ay);
  game.grid[ay][ax] = cell('tin', d, len, game.tick);
  game.grid[by][bx] = cell('tout', d, len, game.tick);
}

// Remove whatever is on a tile (both ends of a tunnel). Returns the removed type or null.
export function removeAt(game, x, y) {
  const c = inB(game, x, y) && game.grid[y][x];
  if (!c) return null;
  game.grid[y][x] = null;
  if (c.t === 'tin' || c.t === 'tout') {
    const [px, py] = tunnelPartner(c, x, y);
    const p = inB(game, px, py) && game.grid[py][px];
    if (p && (p.t === 'tin' || p.t === 'tout')) game.grid[py][px] = null;
  }
  return c.t;
}

// ---------- layout changes and undo ----------
// Any change restarts win verification.
export function markChanged(game) {
  game.changeTick = game.tick;
  game.holdStart = -1;
  game.shortTick = -1e9;
  game.wonSinceChange = false;
}

// One snapshot per gesture: the first change in a gesture records the layout before it.
export function beginChange(game) {
  markChanged(game);
  if (game.gestureSnap) return;
  game.undo.push(layout(game));
  if (game.undo.length > 60) game.undo.shift();
  game.gestureSnap = true;
  game.onChange();
}

export function undo(game) {
  if (!game.undo.length) return false;
  loadLayout(game, game.undo.pop());
  markChanged(game);
  return true;
}

export function clearFloor(game) {
  game.undo.push(layout(game));
  game.grid = emptyGrid(game);
  markChanged(game);
}

// ---------- scoring ----------
// Tiles: every occupied tile, belts and tunnel ends included. Machines: miners, furnaces, assemblers.
export function stats(game) {
  let tiles = 0, buildings = 0;
  for (const row of game.grid) for (const c of row) {
    if (!c) continue;
    tiles++;
    if (isMachine(c.t)) buildings++;
  }
  return { tiles, buildings };
}

// Star rules beyond the first: { tiles: n } or { buildings: n }, each met independently.
export function ruleMet(rule, s) {
  if (rule.tiles != null) return s.tiles <= rule.tiles;
  if (rule.buildings != null) return s.buildings <= rule.buildings;
  return false;
}

export function scoreLayout(game) {
  const s = stats(game);
  const met = [true, ...game.level.stars.map(r => ruleMet(r, s))];
  return { stats: s, met, stars: met.filter(Boolean).length };
}

// ---------- simulation ----------
// fx..ty (where it came from and the hub tile it entered) are only for the renderer's animation.
function deliver(game, item, fx, fy, tx, ty) {
  game.deliveries.push([game.tick, item]);
  game.onDeliver(item, fx, fy, tx, ty);
  if (item === game.level.target.item) {
    game.hubTotal++;
    if (game.holdStart < 0 && !game.wonSinceChange) game.holdStart = game.tick;
  }
}

// Offer an item from (fx, fy) to the tile (tx, ty). Returns true if it was taken.
function accept(game, tx, ty, item, fx, fy) {
  if (!inB(game, tx, ty)) return false;
  if (game.terrain[ty][tx] === 'hub') { deliver(game, item, fx, fy, tx, ty); return true; }
  const c = game.grid[ty][tx];
  if (!c) return false;
  const dir = dirOf(tx - fx, ty - fy); // direction the item is travelling
  const fromFront = tx + DX[c.d] === fx && ty + DY[c.d] === fy;
  switch (c.t) {
    case 'belt':
      if (fromFront || c.item) return false;
      c.item = item; c.prog = 0;
      return true;
    case 'tin': {
      if (fromFront) return false;
      const last = c.q[c.q.length - 1];
      if (last && last.prog < BELT_TICKS) return false;
      c.q.push({ item, prog: 0 });
      return true;
    }
    case 'tout':
      return false; // only fed from its own tunnel
    case 'cross': {
      const lane = dir % 2;
      if (c.lanes[lane]) return false;
      c.lanes[lane] = { item, prog: 0, dir };
      return true;
    }
    case 'split':
      if (c.item) return false;
      c.item = item; c.prog = 0; c.from = (dir + 2) % 4;
      return true;
    case 'furnace': {
      if (fromFront || !SMELT[item]) return false;
      // a furnace works on one kind of ore at a time; it switches once it is empty
      const holding = (c.inv[c.ore] || 0) > 0 || c.busy || c.out > 0;
      if (holding && c.ore !== item) return false;
      if ((c.inv[item] || 0) >= FURNACE_CAP) return false;
      c.ore = item;
      c.inv = { [item]: (c.inv[item] || 0) + 1 };
      return true;
    }
    case 'assembler': {
      if (fromFront) return false;
      const r = RECIPES[c.recipe];
      if (!r.in[item] || (c.inv[item] || 0) >= capFor(r, item)) return false;
      c.inv[item] = (c.inv[item] || 0) + 1;
      return true;
    }
    default:
      return false; // miners take nothing
  }
}

// Phase 1: timers and progress.
function advance(game, c) {
  switch (c.t) {
    case 'belt': case 'tout': case 'split':
      if (c.item && c.prog < BELT_TICKS) c.prog++;
      break;
    case 'cross':
      for (const l of c.lanes) if (l && l.prog < BELT_TICKS) l.prog++;
      break;
    case 'tin':
      c.q.forEach((it, i) => {
        const limit = i === 0 ? c.len * BELT_TICKS : c.q[i - 1].prog - BELT_TICKS;
        if (it.prog < limit) it.prog++;
      });
      break;
    default: {
      const r = recipeOf(c);
      // start the next batch once fewer than one batch's worth is still waiting to leave
      if (!c.busy && c.out < r.n) {
        const ready = Object.entries(r.in).every(([it, k]) => (c.inv[it] || 0) >= k);
        if (ready) {
          for (const [it, k] of Object.entries(r.in)) c.inv[it] -= k;
          c.busy = true; c.timer = 0; c.making = r.out;
        }
      }
      if (c.busy) {
        c.timer++;
        if (c.timer >= CYCLE) {
          c.busy = false; c.out += r.n;
          c.done.push(game.tick);
          while (c.done.length && c.done[0] <= game.tick - MACHINE_WINDOW) c.done.shift();
        }
      }
    }
  }
}

// Phase 2: move items. Whatever an item is moving into is resolved first, so a full line of
// belts moves together in one tick whichever way it points.
function moveAll(game) {
  const { grid, W, H } = game;
  const seen = new Uint8Array(W * H);
  const resolveAt = (x, y) => { if (inB(game, x, y) && grid[y][x]) resolve(x, y); };

  function resolve(x, y) {
    const k = y * W + x;
    if (seen[k]) return;
    seen[k] = 1;
    const c = grid[y][x];
    switch (c.t) {
      case 'belt': case 'tout': {
        if (!c.item || c.prog < BELT_TICKS) return;
        const tx = x + DX[c.d], ty = y + DY[c.d];
        resolveAt(tx, ty);
        if (accept(game, tx, ty, c.item, x, y)) { c.item = null; c.prog = 0; }
        return;
      }
      case 'cross':
        c.lanes.forEach((l, i) => {
          if (!l || l.prog < BELT_TICKS) return;
          const tx = x + DX[l.dir], ty = y + DY[l.dir];
          resolveAt(tx, ty);
          if (accept(game, tx, ty, l.item, x, y)) c.lanes[i] = null;
        });
        return;
      case 'tin': {
        const head = c.q[0];
        if (!head || head.prog < c.len * BELT_TICKS) return;
        const [ex, ey] = tunnelPartner(c, x, y);
        resolveAt(ex, ey);
        const e = inB(game, ex, ey) && grid[ey][ex];
        if (e && e.t === 'tout' && !e.item) { e.item = head.item; e.prog = 0; c.q.shift(); }
        return;
      }
      case 'split': {
        if (!c.item || c.prog < BELT_TICKS) return;
        for (let i = 1; i <= 4; i++) {
          const dir = (c.rr + i) % 4;
          if (dir === c.from) continue;
          const tx = x + DX[dir], ty = y + DY[dir];
          resolveAt(tx, ty);
          if (accept(game, tx, ty, c.item, x, y)) { c.item = null; c.prog = 0; c.rr = dir; return; }
        }
        return;
      }
      default: {
        if (c.out > 0) {
          const tx = x + DX[c.d], ty = y + DY[c.d];
          resolveAt(tx, ty);
          if (accept(game, tx, ty, c.making, x, y)) c.out--;
        }
        c.status = c.busy ? 'working' : (c.out > 0 ? 'blocked' : 'starved');
      }
    }
  }

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x]) resolve(x, y);
}

export function step(game) {
  game.tick++;
  game.grid.forEach((row, y) => row.forEach((c, x) => {
    if (!c) return;
    if (c.t === 'miner') c.mines = MINED[game.terrain[y][x]] || 'ore';
    advance(game, c);
  }));
  moveAll(game);

  // drop deliveries older than the readout window
  const d = game.deliveries;
  while (d.length && d[0][0] <= game.tick - WINDOW_TICKS) d.shift();

  // hold timer
  if (game.holdStart >= 0 && !game.wonSinceChange) {
    const { item, rate: target } = game.level.target;
    const held = game.tick - game.holdStart;
    const from = Math.max(game.holdStart - 1, game.tick - CHECK_TICKS);
    let n = 0;
    for (let i = d.length - 1; i >= 0 && d[i][0] > from; i--) if (d[i][1] === item) n++;
    const need = Math.floor((Math.min(held, CHECK_TICKS) * target) / (60 * TPS));
    if (n < need) {
      game.holdStart = -1;
      game.shortTick = game.tick;
    } else if (held >= HOLD_TICKS) {
      game.wonSinceChange = true;
      game.onWin(scoreLayout(game));
    }
  }
}

// Seconds on the hold timer (0 when it isn't running).
export function heldSeconds(game) {
  return game.holdStart >= 0 ? (game.tick - game.holdStart) / TPS : 0;
}

// Items of one kind delivered to the hub per minute, over a rolling window of up to 60 s.
// While the line is warming up, the window starts at the first delivery so the number isn't
// dragged down by the time before anything arrived.
export function rate(game, item) {
  let n = 0, first = -1;
  for (const d of game.deliveries) if (d[1] === item) { n++; if (first < 0) first = d[0]; }
  if (!n) return 0;
  const win = Math.max(15 * TPS, Math.min(WINDOW_TICKS, game.tick - first));
  return (n * 60 * TPS) / win;
}

// A machine's recent output per minute, what it used, and how busy it has been (0..1), over up to 30 s.
export function machineRates(game, c) {
  const r = recipeOf(c);
  const win = Math.min(MACHINE_WINDOW, Math.max(10 * TPS, game.tick - c.born));
  const crafts = (c.done.filter(t => t > game.tick - win).length * 60 * TPS) / win;
  const uses = Object.entries(r.in).map(([item, k]) => ({ item, perMin: crafts * k }));
  return { out: crafts * r.n, item: r.out, uses, busy: Math.min(1, (crafts * CYCLE) / (60 * TPS)) };
}
