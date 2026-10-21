// Grid state, fixed-step tick, belts, machines, hub delivery, rate measurement and win detection.
// Everything runs on whole ticks (20 per second) so the same layout always gives the same result.
import { buildTerrain } from './levels.js';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIRNAME = ['up', 'right', 'down', 'left'];
export const NAME = { belt: 'Belt', miner: 'Miner', furnace: 'Furnace', assembler: 'Assembler' };

export const TPS = 20;            // ticks per second
export const STEP = 1 / TPS;      // seconds per tick
export const BELT_TICKS = 8;      // ticks for an item to cross one belt tile (2.5 tiles per second)
export const BELT_SPEED = TPS / BELT_TICKS;

export const RECIPE = {
  miner: { ticks: 40, out: 'ore' },
  furnace: { in: 'ore', need: 1, cap: 4, ticks: 40, out: 'plate' },
  assembler: { in: 'plate', need: 2, cap: 6, ticks: 40, out: 'gear' },
};

// Win rule: once a target item reaches the hub after the last layout change, a hold timer starts.
// The line must keep up the target rate until the timer reaches HOLD. While it runs, deliveries
// are counted over a sliding CHECK window (or since the timer started, if that's shorter); a
// shortfall restarts the timer at the next delivery. Target rates must be even, so a CHECK
// window holds a whole number of items.
export const WINDOW_TICKS = 60 * TPS;   // rate readout window
export const CHECK_TICKS = 30 * TPS;
export const HOLD_TICKS = 45 * TPS;
export const HOLD_SECONDS = HOLD_TICKS / TPS;

export const WHY = {
  off: 'That is off the floor.',
  rock: 'Rock is in the way.',
  hub: 'That is the hub.',
  noore: 'Miners need to sit on ore.',
};

export const cell = (t, d) => ({ t, d, item: null, prog: 0, inv: 0, out: 0, busy: false, timer: 0, status: 'starved' });

export function createGame(level) {
  const game = { running: true, speed: 1, onChange: () => {}, onWin: () => {} };
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
  for (const [x, y, t, d] of game.level.starter || []) game.grid[y][x] = cell(t, d);
}

export function layout(game) {
  return game.grid.map(r => r.map(c => (c ? [c.t, c.d] : null)));
}

export function loadLayout(game, l) {
  game.grid = l.map(r => r.map(v => (v ? cell(v[0], v[1]) : null)));
}

export const inB = (game, x, y) => x >= 0 && y >= 0 && x < game.W && y < game.H;

export function canPlace(game, x, y, t) {
  if (!inB(game, x, y)) return 'off';
  const tr = game.terrain[y][x];
  if (tr === 'rock') return 'rock';
  if (tr === 'hub') return 'hub';
  if (t === 'miner' && tr !== 'ore') return 'noore';
  return '';
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
export function stats(game) {
  let tiles = 0, buildings = 0;
  for (const row of game.grid) for (const c of row) {
    if (!c) continue;
    tiles++;
    if (c.t !== 'belt') buildings++;
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
function deliver(game, item) {
  game.deliveries.push([game.tick, item]);
  if (item === game.level.target.item) {
    game.hubTotal++;
    if (game.holdStart < 0 && !game.wonSinceChange) game.holdStart = game.tick;
  }
}

function accept(game, tx, ty, item, fx, fy) {
  if (!inB(game, tx, ty)) return false;
  if (game.terrain[ty][tx] === 'hub') { deliver(game, item); return true; }
  const c = game.grid[ty][tx];
  if (!c) return false;
  if (tx + DX[c.d] === fx && ty + DY[c.d] === fy) return false; // never push into a building's output side
  if (c.t === 'belt') {
    if (c.item) return false;
    c.item = item; c.prog = 0;
    return true;
  }
  const r = RECIPE[c.t];
  if (!r.in || r.in !== item || c.inv >= r.cap) return false;
  c.inv++;
  return true;
}

export function step(game) {
  game.tick++;
  const { grid, W, H } = game;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[y][x];
    if (!c) continue;
    const fx = x + DX[c.d], fy = y + DY[c.d];
    if (c.t === 'belt') {
      if (c.item) {
        if (c.prog < BELT_TICKS) c.prog++;
        if (c.prog >= BELT_TICKS && accept(game, fx, fy, c.item, x, y)) { c.item = null; c.prog = 0; }
      }
      continue;
    }
    const r = RECIPE[c.t];
    if (!c.busy && c.out === 0) {
      if (c.t === 'miner') { c.busy = true; c.timer = 0; }
      else if (c.inv >= r.need) { c.inv -= r.need; c.busy = true; c.timer = 0; }
    }
    if (c.busy) { c.timer++; if (c.timer >= r.ticks) { c.busy = false; c.out = 1; } }
    if (c.out > 0 && accept(game, fx, fy, r.out, x, y)) c.out = 0;
    c.status = c.busy ? 'working' : (c.out > 0 ? 'blocked' : 'starved');
  }

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
