// Grid state, fixed-step tick, belts, machines, hub delivery and rate measurement.
import { buildTerrain } from './levels.js';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIRNAME = ['up', 'right', 'down', 'left'];
export const NAME = { belt: 'Belt', miner: 'Miner', furnace: 'Furnace', assembler: 'Assembler' };
export const RECIPE = {
  miner: { time: 2, out: 'ore' },
  furnace: { in: 'ore', need: 1, cap: 4, time: 2, out: 'plate' },
  assembler: { in: 'plate', need: 2, cap: 6, time: 2, out: 'gear' },
};
export const BELT_SPEED = 2.5; // tiles per second
export const STEP = 0.05;      // fixed tick: 20 steps per second

export const WHY = {
  off: 'That is off the floor.',
  rock: 'Rock is in the way.',
  hub: 'That is the hub.',
  noore: 'Miners need to sit on ore.',
};

export const cell = (t, d) => ({ t, d, item: null, prog: 0, inv: 0, out: 0, busy: false, timer: 0, status: 'starved' });

export function createGame(level) {
  const game = {
    level,
    W: level.w,
    H: level.h,
    terrain: buildTerrain(level),
    grid: null,
    simTime: 0,
    running: true,
    deliveries: [],
    hubTotal: 0,
    undo: [],
    gestureSnap: false,
    onChange: () => {},
  };
  loadStarter(game);
  return game;
}

export function emptyGrid(game) {
  return Array.from({ length: game.H }, () => Array(game.W).fill(null));
}

export function loadStarter(game) {
  game.grid = emptyGrid(game);
  for (const [x, y, t, d] of game.level.starter) game.grid[y][x] = cell(t, d);
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

// ---------- undo ----------
// One snapshot per gesture: the first change in a gesture records the layout before it.
export function beginChange(game) {
  if (game.gestureSnap) return;
  game.undo.push(layout(game));
  if (game.undo.length > 60) game.undo.shift();
  game.gestureSnap = true;
  game.onChange();
}

export function undo(game) {
  if (!game.undo.length) return false;
  loadLayout(game, game.undo.pop());
  return true;
}

export function clearFloor(game) {
  game.undo.push(layout(game));
  game.grid = emptyGrid(game);
}

// ---------- simulation ----------
function deliver(game, item) {
  game.deliveries.push([game.simTime, item]);
  if (item === game.level.target.item) game.hubTotal++;
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

export function step(game, dt) {
  game.simTime += dt;
  const { grid, W, H } = game;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[y][x];
    if (!c) continue;
    const fx = x + DX[c.d], fy = y + DY[c.d];
    if (c.t === 'belt') {
      if (c.item) {
        c.prog = Math.min(1, c.prog + BELT_SPEED * dt);
        if (c.prog >= 1 && accept(game, fx, fy, c.item, x, y)) { c.item = null; c.prog = 0; }
      }
      continue;
    }
    const r = RECIPE[c.t];
    if (!c.busy && c.out === 0) {
      if (c.t === 'miner') { c.busy = true; c.timer = 0; }
      else if (c.inv >= r.need) { c.inv -= r.need; c.busy = true; c.timer = 0; }
    }
    if (c.busy) { c.timer += dt; if (c.timer >= r.time) { c.busy = false; c.out = 1; } }
    if (c.out > 0 && accept(game, fx, fy, r.out, x, y)) c.out = 0;
    c.status = c.busy ? 'working' : (c.out > 0 ? 'blocked' : 'starved');
  }
  const d = game.deliveries;
  while (d.length && d[0][0] < game.simTime - 60) d.shift();
}

// Items delivered to the hub per minute, over a rolling window of up to 60 s.
export function rate(game, item) {
  const win = Math.max(15, Math.min(60, game.simTime));
  let n = 0;
  for (const d of game.deliveries) if (d[1] === item) n++;
  return (n * 60) / win;
}
