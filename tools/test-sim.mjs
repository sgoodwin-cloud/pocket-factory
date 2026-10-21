// Mechanics tests for the simulation. Run with: node tools/test-sim.mjs
import { createGame, step, cell, emptyGrid, rate, TPS, removeAt, layout, loadLayout } from '../js/sim.js';
import { parseLayout } from '../js/layout.js';

// A test level: ore on every tile (so miners can go anywhere), a hub, optional rocks.
function level(w, h, hub, { rocks = [], item = 'ore' } = {}) {
  const ore = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ore.push([x, y]);
  return { id: 'test', w, h, ore, rocks, hub, target: { item, rate: 30 }, tools: [], stars: [] };
}
function run(lv, rows, seconds = 120) {
  const game = createGame(lv);
  game.grid = emptyGrid(game);
  for (const [x, y, t, d, len] of parseLayout(rows)) game.grid[y][x] = cell(t, d, len);
  for (let i = 0; i < seconds * TPS; i++) step(game);
  return game;
}
let fails = 0;
const check = (label, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${label}${info ? ` (${info})` : ''}`); };
const perMin = (g, item) => Math.round(rate(g, item));

// 1. Full belts run at 150/min whichever way they point. Five side-fed miners fill one belt.
const up = run(level(2, 8, { x: 0, y: 0, w: 2, h: 2 }), [
  '.. ..', '.. ..', 'b^ ..', 'b^ m<', 'b^ m<', 'b^ m<', 'b^ m<', 'b^ m<',
]);
const down = run(level(2, 8, { x: 0, y: 6, w: 2, h: 2 }), [
  'bv m<', 'bv m<', 'bv m<', 'bv m<', 'bv m<', 'bv ..',
]);
const left = run(level(8, 3, { x: 0, y: 0, w: 2, h: 2 }), [
  '.. .. .. .. .. .. .. ..',
  '.. .. b< b< b< b< b< b<',
  '.. .. .. m^ m^ m^ m^ m^',
]);
const right = run(level(8, 3, { x: 6, y: 0, w: 2, h: 2 }), [
  '.. .. .. .. .. .. .. ..',
  'b> b> b> b> b> b> .. ..',
  'm^ m^ m^ m^ m^ .. .. ..',
]);
const r = { up: perMin(up, 'ore'), down: perMin(down, 'ore'), left: perMin(left, 'ore'), right: perMin(right, 'ore') };
check('full belts deliver 150/min in every direction', Object.values(r).every(v => v >= 148), JSON.stringify(r));

// 2. A tunnel carries a busy line under rocks at full belt speed (4 miners, 120/min).
const tun = run(level(9, 5, { x: 0, y: 0, w: 2, h: 2 }, { rocks: [[3, 3], [4, 3]] }), [
  '.. .. .. .. .. .. .. .. ..',
  '.. .. .. .. .. .. .. .. ..',
  'b^ .. .. .. .. .. .. .. ..',
  'b^ b< T< .. .. t< b< b< b<',
  '.. .. .. .. .. m^ m^ m^ m^',
]);
check('tunnel passes under rocks at full speed', perMin(tun, 'ore') >= 118, `${perMin(tun, 'ore')}/min from 4 miners`);

// 3. A crossing carries two lines straight through one tile (2 miners, 60/min).
const cr = run(level(7, 7, { x: 3, y: 0, w: 2, h: 2 }), [
  '.. .. .. .. .. .. ..',
  '.. .. .. .. .. .. ..',
  '.. .. .. b^ b^ b< ..',
  'm> b> b> x. b> b^ ..',
  '.. .. .. b^ .. .. ..',
  '.. .. .. b^ .. .. ..',
  '.. .. .. m^ .. .. ..',
]);
check('crossing carries two lines through one tile', perMin(cr, 'ore') >= 59, `${perMin(cr, 'ore')}/min from 2 miners`);

// 4. A splitter shares one ore line between two furnaces (60 plates/min).
const sp = run(level(5, 6, { x: 1, y: 0, w: 3, h: 2 }, { item: 'plate' }), [
  '.. .. .. .. ..',
  '.. .. .. .. ..',
  '.. b^ .. b^ ..',
  '.. f^ s. f^ ..',
  '.. .. b^ .. ..',
  '.. m> b^ m< ..',
]);
check('splitter feeds two furnaces evenly', perMin(sp, 'plate') >= 59, `${perMin(sp, 'plate')} plates/min`);

// 5. Tunnel ends are saved with their length, and removing one end removes both.
const g = createGame(level(8, 1, { x: 0, y: 0, w: 0, h: 0 }));
g.grid = emptyGrid(g);
for (const [x, y, t, d, len] of parseLayout(['.. .. t> .. .. T> .. ..'])) g.grid[y][x] = cell(t, d, len);
loadLayout(g, JSON.parse(JSON.stringify(layout(g))));
check('tunnel length survives save and load', g.grid[0][2].len === 3 && g.grid[0][5].len === 3);
removeAt(g, 5, 0);
check('removing one tunnel end removes both', !g.grid[0][2] && !g.grid[0][5]);

console.log(fails ? `\n${fails} failure(s)` : '\nAll mechanics tests passed');
process.exit(fails ? 1 : 0);
