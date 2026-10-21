// Proves every level is solvable: builds a known solution, runs the real simulation and checks
// that the hub verifies the target and the layout earns all three stars. Also checks a few
// near-miss layouts do NOT win. Run with: node tools/verify-levels.mjs
import { LEVELS } from '../js/levels.js';
import { createGame, setLevel, step, canPlace, cell, emptyGrid, loadStarter, TPS, scoreLayout, rate } from '../js/sim.js';
import { parseLayout } from '../js/layout.js';

// Layouts as [x, y, type, dir]; dir 0 up, 1 right, 2 down, 3 left.
const U = 0, R = 1, D = 2, L = 3;
const col = (x, y0, y1, d) => { const out = []; for (let y = y0; y >= y1; y--) out.push([x, y, 'belt', d]); return out; };

const SOLUTIONS = {
  'first-delivery': {
    best: [[1, 6, 'miner', U], ...col(1, 5, 2, U), [1, 1, 'belt', R]],
  },
  'smelting': {
    tutorial: { remove: [[4, 7]], add: [[4, 7, 'furnace', U]], stars: 2 },
    misses: { 'starter only (delivers ore)': 'starter' },
    best: [[5, 7, 'miner', U], [5, 6, 'furnace', U], ...col(5, 5, 2, U).slice(0, 3), [5, 2, 'belt', L], [4, 2, 'belt', L], [3, 2, 'belt', U]],
  },
  'double-up': {
    best: [
      [2, 9, 'miner', R], [3, 9, 'furnace', U], ...col(3, 8, 2, U),
      [2, 8, 'miner', U], [2, 7, 'furnace', R],
    ],
    misses: {
      'one furnace only': [[2, 9, 'miner', R], [3, 9, 'furnace', U], ...col(3, 8, 2, U), [2, 8, 'miner', U], [2, 7, 'belt', R]],
    },
  },
  'gear-works': {
    best: [
      [2, 9, 'miner', U], [2, 8, 'furnace', U], [2, 7, 'assembler', U],
      [1, 8, 'miner', U], [1, 7, 'furnace', R],
      ...col(2, 6, 2, U).slice(0, 4), [2, 2, 'belt', R], [3, 2, 'belt', U],
    ],
    misses: {
      'starter only': 'starter',
      'one furnace feeding the assembler': [
        [2, 10, 'miner', R], [3, 10, 'belt', U], [3, 9, 'belt', U], [3, 8, 'furnace', U],
        [3, 7, 'assembler', U], ...col(3, 6, 2, U), [2, 9, 'miner', R],
      ],
    },
  },
  'tight-squeeze': {
    best: [
      [0, 7, 'miner', R], [1, 7, 'furnace', U], [1, 6, 'belt', U],
      [0, 6, 'miner', U], [0, 5, 'furnace', R],
      [1, 5, 'assembler', U], ...col(1, 4, 2, U), [1, 1, 'belt', R],
    ],
  },
  'assembly-line': {
    best: [
      '.. .. .. .. .. .. .. ..',
      '.. .. .. .. .. .. .. ..',
      '.. b> b> b^ b^ b< b< ..',
      '.. b^ .. .. .. .. b^ ..',
      '.. b^ .. .. .. .. b^ ..',
      '.. b^ .. .. .. .. b^ ..',
      '.. b^ .. .. .. .. b^ ..',
      '.. b^ .. .. .. .. b^ ..',
      'b> a^ .. .. .. .. a^ b<',
      'f^ f^ .. .. .. .. f^ f^',
      'm^ m^ .. .. .. .. m^ m^',
    ],
  },
  'under-the-wall': {
    tutorial: { add: ['.. .. T^ .. .. ..', '.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. .. t^ .. .. ..'], at: 2, stars: 3 },
    misses: { 'starter only (no way past the wall)': 'starter' },
    best: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. T^ .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. t^ .. .. ..',
      '.. .. f^ .. .. ..',
      '.. .. m^ .. .. ..',
    ],
  },
  'crossroads': {
    misses: { 'starter only (ore pushed into the plate line)': 'starter' },
    best: [
      '.. .. .. .. ..',
      '.. .. .. b< ..',
      '.. b^ .. b^ ..',
      '.. b^ .. b^ ..',
      'm> x. f> b^ ..',
      '.. b^ .. .. ..',
      '.. f^ .. .. ..',
      '.. m^ .. .. ..',
    ],
  },
  'fork': {
    misses: {
      'starter only (delivers ore)': 'starter',
      'one furnace on the line': ['.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. .. b^ .. .. ..', '.. .. f^ .. .. ..', '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. m> b^ m< .. ..'],
      'splitter also feeding the hub': ['.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. b^ b^ b^ .. ..', '.. f^ s. f^ .. ..', '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. m> b^ m< .. ..'],
    },
    best: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. b^ .. b^ .. ..',
      '.. f^ s. f^ .. ..',
      '.. .. b^ .. .. ..',
      '.. .. b^ .. .. ..',
      '.. m> b^ m< .. ..',
    ],
  },
  'long-haul': {
    alt: { stars: 2, label: 'no tunnels', rows: [
      '.. .. .. .. .. ..', '.. .. .. .. .. ..',
      '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. .. b^ .. .. ..',
      '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. .. b^ b< .. ..',
      '.. .. f^ f^ .. ..', '.. .. m^ m^ .. ..',
    ] },
    best: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. T^ .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. t^ .. .. ..',
      '.. .. T^ .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. t^ b< .. ..',
      '.. .. f^ f^ .. ..',
      '.. .. m^ m^ .. ..',
    ],
  },
  'over-the-ridge': {
    alt: { stars: 1, label: 'the long way round, no tunnels', rows: [
      '.. .. .. .. .. .. ..',
      '.. .. .. .. .. .. ..',
      '.. .. b^ b< b< b< b<',
      '.. .. .. .. .. .. b^',
      '.. .. .. .. .. .. b^',
      '.. .. .. .. .. .. b^',
      '.. .. b> b> b> b> b^',
      '.. f> a^ .. .. .. ..',
      '.. m^ b^ .. .. .. ..',
      '.. m> f^ .. .. .. ..',
    ] },
    best: [
      '.. .. .. .. .. .. ..',
      '.. .. .. .. .. .. ..',
      '.. .. T^ .. .. .. ..',
      '.. .. .. .. .. .. ..',
      '.. .. .. .. .. .. ..',
      '.. .. .. .. .. .. ..',
      '.. .. t^ .. .. .. ..',
      '.. f> a^ .. .. .. ..',
      '.. m^ b^ .. .. .. ..',
      '.. m> f^ .. .. .. ..',
    ],
  },
  'split-shift': {
    alt: { stars: 2, label: 'no tunnels', rows: [
      '.. .. .. .. .. ..', '.. .. .. .. .. ..',
      '.. .. b^ .. .. ..', '.. .. b^ .. .. ..', '.. .. b^ .. .. ..',
      '.. b> a^ b< .. ..', '.. f^ s. f^ .. ..', '.. .. b^ .. .. ..', '.. m> b^ m< .. ..',
    ] },
    best: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. T^ .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. t^ .. .. ..',
      '.. b> a^ b< .. ..',
      '.. f^ s. f^ .. ..',
      '.. .. b^ .. .. ..',
      '.. m> b^ m< .. ..',
    ],
  },
  'underpass': {
    misses: { 'only one tunnel': [
      '.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. .. T^ .. .. ..', '.. .. .. .. .. ..',
      '.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. .. .. .. .. ..', '.. .. t^ .. .. ..',
      '.. m> f^ f^ m< ..', '.. .. .. .. .. ..',
    ] },
    best: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. T^ T^ .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. t^ t^ .. ..',
      '.. m> f^ f^ m< ..',
      '.. .. .. .. .. ..',
    ],
  },
  'twin-works': {
    best: [
      '.. .. .. .. .. .. .. ..',
      '.. .. .. .. .. .. .. ..',
      '.. .. b> b^ b^ b< .. ..',
      '.. .. T^ .. .. T^ .. ..',
      '.. .. .. .. .. .. .. ..',
      '.. .. .. .. .. .. .. ..',
      '.. .. .. .. .. .. .. ..',
      '.. .. .. .. .. .. .. ..',
      '.. .. t^ .. .. t^ .. ..',
      '.. f> a^ .. .. a^ f< ..',
      '.. m^ b^ .. .. b^ m^ ..',
      '.. m> f^ .. .. f^ m< ..',
    ],
  },
};

function build(game, spec) {
  if (spec === 'starter') return;
  if (spec.remove) {
    loadStarter(game);
    for (const [x, y] of spec.remove) game.grid[y][x] = null;
    for (const [x, y, t, d] of spec.add) game.grid[y][x] = cell(t, d);
    return;
  }
  if (spec.add) {
    // starter plus extra text rows, placed from row spec.at
    loadStarter(game);
    for (const [x, y, t, d, len] of parseLayout(spec.add)) game.grid[y + spec.at][x] = cell(t, d, len);
    return;
  }
  const items = typeof spec[0] === 'string' ? parseLayout(spec) : spec;
  game.grid = emptyGrid(game);
  for (const [x, y, t, d, len] of items) {
    const why = canPlace(game, x, y, t);
    if (why) throw new Error(`${game.level.id}: can't place ${t} at ${x},${y} (${why})`);
    if (game.grid[y][x]) throw new Error(`${game.level.id}: two things at ${x},${y}`);
    game.grid[y][x] = cell(t, d, len);
  }
}

function run(level, spec, seconds = 300) {
  const game = createGame(level);
  setLevel(game, level);
  build(game, spec);
  let win = null;
  game.onWin = s => { if (!win) win = { ...s, at: game.tick / TPS }; };
  for (let i = 0; i < seconds * TPS && !win; i++) step(game);
  return { win, score: scoreLayout(game), perMin: Math.round(rate(game, level.target.item)) };
}

let failures = 0;
for (const level of LEVELS) {
  if (level.target.rate % 2) { console.log(`✗ ${level.id}: target rate must be even`); failures++; }
  const used = new Set();
  const sol = SOLUTIONS[level.id];
  if (!sol) { console.log(`✗ ${level.id}: no solution written`); failures++; continue; }
  const r = run(level, sol.best);
  const ok = r.win && r.win.stars === 3;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${level.name}: ${r.win ? `won at ${r.win.at}s` : 'no win'}, ` +
    `${r.score.stats.tiles} tiles, ${r.score.stats.buildings} buildings, ${r.score.stars} stars, ${r.perMin}/${level.target.rate} per min`);
  if (sol.tutorial) {
    const t = run(level, sol.tutorial);
    const tOk = t.win && t.win.stars === sol.tutorial.stars;
    if (!tOk) failures++;
    console.log(`   ${tOk ? '✓' : '✗'} guided fix wins with ${t.win ? t.win.stars : 0} stars at ${t.win ? t.win.at + 's' : '-'}`);
  }
  if (sol.alt) {
    const a = run(level, sol.alt.rows);
    const aOk = a.win && a.win.stars === sol.alt.stars;
    if (!aOk) failures++;
    console.log(`   ${aOk ? '✓' : '✗'} ${sol.alt.label}: ${a.win ? a.win.stars : 0} star(s), ${a.score.stats.tiles} tiles (expected ${sol.alt.stars})`);
  }
  for (const [label, spec] of Object.entries(sol.misses || {})) {
    const m = run(level, spec);
    if (m.win) failures++;
    console.log(`   ${m.win ? '✗ wrongly won' : '✓ correctly no win'}: ${label} (${m.perMin}/min)`);
  }
}
console.log(failures ? `\n${failures} problem(s)` : '\nAll levels verified');
process.exit(failures ? 1 : 0);
