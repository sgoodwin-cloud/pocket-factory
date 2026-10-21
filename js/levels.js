// Level definitions as data. Coordinates are [x, y] with (0,0) top-left.
// A level gives its floor either as w, h, ore, rocks and hub, or as a text map: one string per
//   row, '.' open, 'o' ore, '#' rock, 'H' hub (a rectangle).
// starter: buildings already on the floor when the level first loads, either as [x, y, type, dir]
//   entries or as text rows in the layout format of js/layout.js. dir: 0 up, 1 right, 2 down, 3 left.
// stars: the rules for stars 2 and 3 (star 1 is hitting the target). { tiles: n } means at most
//   n occupied tiles, belts included; { buildings: n } means at most n machines.
// guide: optional step-by-step coaching, shown until the level is first completed. Each step
//   shows until its condition is met: 'has:<type>' a building of that type exists,
//   'count:<type>:<n>' at least n of them, 'notbelt:x,y' that tile no longer holds a belt,
//   'delivered' a target item reached the hub, 'win'. focus: 'timer' highlights the hold timer.
// target.rate must be even (see the win rule in sim.js).
// Every level has a proven solution in tools/verify-levels.mjs.

import { parseLayout } from './layout.js';

export const PLURAL = { ore: 'ore', plate: 'plates', gear: 'gears' };

export const TIERS = [
  { id: 1, name: 'Iron' },
  { id: 2, name: 'Logistics' },
];
const T1 = ['belt', 'miner', 'furnace', 'assembler'];

export const LEVELS = [
  {
    id: 'first-delivery',
    tier: 1,
    name: 'First Delivery',
    brief: 'Mine ore and belt it to the hub.',
    w: 6, h: 8,
    ore: [[0, 6], [1, 6], [0, 7], [1, 7]],
    rocks: [],
    hub: { x: 2, y: 0, w: 2, h: 2 },
    target: { item: 'ore', rate: 30 },
    tools: ['belt', 'miner'],
    stars: [{ tiles: 8 }, { tiles: 6 }],
    guide: [
      { until: 'has:miner', text: '<b>Step 1.</b> Pick <b>Miner</b> and press on an ore tile. Drag towards the hub before you let go, so its orange notch points that way.' },
      { until: 'delivered', text: '<b>Step 2.</b> Pick <b>Belt</b> and drag a path from the miner\'s notch into the hub.' },
      { until: 'win', focus: 'timer', text: '<b>Step 3.</b> Ore is arriving. To finish, keep <b>30 a minute</b> flowing for <b>45 seconds</b>. The bar above is the timer, and changing the layout restarts it. Tap <b>1×</b> to speed things up.' },
    ],
  },
  {
    id: 'smelting',
    tier: 1,
    name: 'Smelting',
    brief: 'The hub wants plates, but this line delivers raw ore. A furnace turns ore into plates.',
    w: 6, h: 9,
    ore: [[4, 7], [5, 7], [4, 8], [5, 8]],
    rocks: [[3, 3], [4, 3]],
    hub: { x: 2, y: 0, w: 2, h: 2 },
    target: { item: 'plate', rate: 30 },
    tools: ['belt', 'miner', 'furnace'],
    stars: [{ tiles: 10 }, { tiles: 8 }],
    starter: [
      [4, 8, 'miner', 0],
      [4, 7, 'belt', 0], [4, 6, 'belt', 3], [3, 6, 'belt', 3],
      [2, 6, 'belt', 0], [2, 5, 'belt', 0], [2, 4, 'belt', 0], [2, 3, 'belt', 0], [2, 2, 'belt', 0],
    ],
    guide: [
      { until: 'notbelt:4,7', text: '<b>Step 1.</b> This line delivers ore, not plates. <b>Press and hold</b> the belt just above the miner until the red ring fills, to remove it. (The <b>Remove</b> tool works too.)' },
      { until: 'has:furnace', text: '<b>Step 2.</b> Pick <b>Furnace</b>, press on the gap and drag upwards, so its notch points at the belt. Machines pass items straight into a neighbour.' },
      { until: 'win', focus: 'timer', text: '<b>Step 3.</b> Plates are on their way. Hold 30 a minute for 45 seconds to finish. Then try a shorter route for more stars.' },
    ],
  },
  {
    id: 'double-up',
    tier: 1,
    name: 'Double Up',
    brief: 'One furnace makes 30 plates a minute. This order needs 60.',
    w: 8, h: 10,
    ore: [[0, 8], [1, 8], [2, 8], [0, 9], [1, 9], [2, 9]],
    rocks: [[4, 4], [5, 4], [1, 3]],
    hub: { x: 3, y: 0, w: 2, h: 2 },
    target: { item: 'plate', rate: 60 },
    tools: ['belt', 'miner', 'furnace'],
    stars: [{ tiles: 14 }, { tiles: 11 }],
  },
  {
    id: 'gear-works',
    tier: 1,
    name: 'Gear Works',
    brief: 'An assembler turns 2 plates into 1 gear. The plate line is already running.',
    w: 8, h: 12,
    ore: [
      [0, 8], [1, 8],
      [0, 9], [1, 9], [2, 9],
      [0, 10], [1, 10], [2, 10],
      [0, 11], [1, 11], [2, 11],
    ],
    rocks: [[5, 5], [6, 5], [1, 4]],
    hub: { x: 3, y: 0, w: 2, h: 2 },
    target: { item: 'gear', rate: 30 },
    tools: ['belt', 'miner', 'furnace', 'assembler'],
    stars: [{ tiles: 14 }, { tiles: 11 }],
    starter: [
      [2, 10, 'miner', 1],
      [3, 10, 'belt', 0], [3, 9, 'belt', 0],
      [3, 8, 'furnace', 0],
      [3, 7, 'belt', 0], [3, 6, 'belt', 0], [3, 5, 'belt', 0],
      [3, 4, 'belt', 0], [3, 3, 'belt', 0], [3, 2, 'belt', 0],
    ],
  },
  {
    id: 'tight-squeeze',
    tier: 1,
    name: 'Tight Squeeze',
    brief: 'Gears again, on a much smaller floor.',
    w: 6, h: 8,
    ore: [[0, 6], [0, 7], [5, 6], [5, 7]],
    rocks: [[2, 3], [3, 3]],
    hub: { x: 2, y: 0, w: 2, h: 2 },
    target: { item: 'gear', rate: 30 },
    tools: ['belt', 'miner', 'furnace', 'assembler'],
    stars: [{ tiles: 13 }, { tiles: 10 }],
  },
  {
    id: 'assembly-line',
    tier: 1,
    name: 'Assembly Line',
    brief: 'Double the gears: 60 a minute. That takes two assemblers and everything feeding them.',
    map: [
      '...HH...',
      '...HH...',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'oo....oo',
      'oo....oo',
    ],
    target: { item: 'gear', rate: 60 },
    tools: T1,
    stars: [{ tiles: 32 }, { tiles: 28 }],
  },

  // ---------- Tier 2: Logistics ----------
  {
    id: 'under-the-wall',
    tier: 2,
    name: 'Under the Wall',
    brief: 'A wall of rock cuts the floor in two. Belts can\'t cross it, but a tunnel can go under.',
    map: [
      '..HH..',
      '..HH..',
      '......',
      '......',
      '######',
      '......',
      '......',
      '......',
      '..oo..',
    ],
    target: { item: 'plate', rate: 30 },
    tools: ['belt', 'miner', 'furnace', 'tunnel'],
    stars: [{ tiles: 6 }, { tiles: 4 }],
    starter: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. f^ .. .. ..',
      '.. .. m^ .. .. ..',
    ],
    guide: [
      { until: 'has:tin', text: '<b>Step 1.</b> Pick <b>Tunnel</b>. Press on the tile above the furnace and drag up, past the wall, to the tile just below the hub. Then let go.' },
      { until: 'win', focus: 'timer', text: '<b>Step 2.</b> Plates go in the entrance and come up at the exit. Only the two ends count as tiles, so tunnels are a cheap way across open floor too.' },
    ],
  },
  {
    id: 'crossroads',
    tier: 2,
    name: 'Crossroads',
    brief: 'Two lines need the same tile. A crossing lets them pass straight through each other.',
    map: [
      '.HH..',
      '.HH..',
      '#.#..',
      '#.#..',
      'o....',
      '#.#..',
      '#.#..',
      '#o#..',
    ],
    target: { item: 'plate', rate: 60 },
    tools: ['belt', 'miner', 'furnace', 'cross'],
    stars: [{ tiles: 14 }, { tiles: 12 }],
    starter: [
      '.. .. .. .. ..',
      '.. .. .. .. ..',
      '.. b^ .. .. ..',
      '.. b^ .. .. ..',
      'm> b^ .. .. ..',
      '.. b^ .. .. ..',
      '.. f^ .. .. ..',
      '.. m^ .. .. ..',
    ],
    guide: [
      { until: 'has:cross', text: '<b>Step 1.</b> The left miner pushes ore into the plate line. Hold the belt in front of it to remove it, then pick <b>Crossing</b> and tap the gap.' },
      { until: 'count:furnace:2', text: '<b>Step 2.</b> Ore now passes straight across. Put a furnace on the far side to smelt it.' },
      { until: 'win', focus: 'timer', text: '<b>Step 3.</b> Belt the new plates up to the hub. The order is 60 a minute, so both lines need to arrive.' },
    ],
  },
  {
    id: 'fork',
    tier: 2,
    name: 'Fork',
    brief: 'Two miners fill one belt with 60 ore a minute, but a furnace smelts only 30.',
    map: [
      '.HHH..',
      '.HHH..',
      '......',
      '......',
      '......',
      '##.###',
      '#o.o##',
    ],
    target: { item: 'plate', rate: 60 },
    tools: ['belt', 'miner', 'furnace', 'split'],
    stars: [{ tiles: 12 }, { tiles: 10 }],
    starter: [
      '.. .. .. .. .. ..',
      '.. .. .. .. .. ..',
      '.. .. b^ .. .. ..',
      '.. .. b^ .. .. ..',
      '.. .. b^ .. .. ..',
      '.. .. b^ .. .. ..',
      '.. m> b^ m< .. ..',
    ],
    guide: [
      { until: 'has:split', text: '<b>Step 1.</b> Hold a belt partway up the line to remove it, then pick <b>Splitter</b> and tap the gap. A splitter hands items in turn to everything it touches.' },
      { until: 'count:furnace:2', text: '<b>Step 2.</b> Put a furnace on each side of the splitter. Anything else it touches gets ore too, so clear the belt above it.' },
      { until: 'win', focus: 'timer', text: '<b>Step 3.</b> Belt both furnaces\' plates into the hub and hold 60 a minute.' },
    ],
  },
  {
    id: 'long-haul',
    tier: 2,
    name: 'Long Haul',
    brief: 'A long way from ore to hub. Tunnels only count their two ends, so use them to save tiles.',
    map: [
      '..HH..',
      '..HH..',
      '......',
      '......',
      '......',
      '......',
      '......',
      '......',
      '......',
      '......',
      '..oo..',
      '..oo..',
    ],
    target: { item: 'plate', rate: 60 },
    tools: ['belt', 'miner', 'furnace', 'tunnel'],
    stars: [{ tiles: 13 }, { tiles: 9 }],
  },
  {
    id: 'over-the-ridge',
    tier: 2,
    name: 'Over the Ridge',
    brief: 'Gears again, with a ridge of rock in the way. The long way round is open, but costly.',
    map: [
      '..HH...',
      '..HH...',
      '.......',
      '.......',
      '######.',
      '######.',
      '.......',
      '.......',
      'oo.....',
      'oo.....',
    ],
    target: { item: 'gear', rate: 30 },
    tools: [...T1, 'tunnel', 'cross'],
    stars: [{ tiles: 12 }, { tiles: 8 }],
  },
  {
    id: 'split-shift',
    tier: 2,
    name: 'Split Shift',
    brief: 'One pocket of ore with a single way out has to feed a whole gear line.',
    map: [
      '..HH..',
      '..HH..',
      '......',
      '......',
      '......',
      '......',
      '......',
      '##.###',
      '#o.o##',
    ],
    target: { item: 'gear', rate: 30 },
    tools: [...T1, 'tunnel', 'split'],
    stars: [{ tiles: 14 }, { tiles: 12 }],
  },
  {
    id: 'underpass',
    tier: 2,
    name: 'Underpass',
    brief: 'The hub sits behind solid rock. Only a tunnel will reach it.',
    map: [
      '.#HH#.',
      '.#HH#.',
      '.#..#.',
      '######',
      '......',
      '......',
      '......',
      '......',
      'oo..oo',
      'oo..oo',
    ],
    target: { item: 'plate', rate: 60 },
    tools: ['belt', 'miner', 'furnace', 'tunnel', 'cross', 'split'],
    stars: [{ tiles: 10 }, { tiles: 8 }],
  },
  {
    id: 'twin-works',
    tier: 2,
    name: 'Twin Works',
    brief: 'The big one for this tier: 60 gears a minute, from two ore fields, under a ridge.',
    map: [
      '...HH...',
      '...HH...',
      '........',
      '........',
      '########',
      '########',
      '........',
      '........',
      '........',
      '........',
      'oo....oo',
      'oo....oo',
    ],
    target: { item: 'gear', rate: 60 },
    tools: [...T1, 'tunnel', 'cross', 'split'],
    stars: [{ tiles: 24 }, { tiles: 20 }],
  },
];

// Fill in w, h, ore, rocks and hub from a text map, and parse text starters.
for (const lv of LEVELS) {
  if (lv.map) {
    lv.h = lv.map.length;
    lv.w = lv.map[0].length;
    lv.ore = []; lv.rocks = [];
    let hx = Infinity, hy = Infinity, hx2 = -1, hy2 = -1;
    lv.map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'o') lv.ore.push([x, y]);
      else if (ch === '#') lv.rocks.push([x, y]);
      else if (ch === 'H') { hx = Math.min(hx, x); hy = Math.min(hy, y); hx2 = Math.max(hx2, x); hy2 = Math.max(hy2, y); }
    }));
    lv.hub = { x: hx, y: hy, w: hx2 - hx + 1, h: hy2 - hy + 1 };
  }
  if (lv.starter && typeof lv.starter[0] === 'string') lv.starter = parseLayout(lv.starter);
}

export function buildTerrain(level) {
  const t = Array.from({ length: level.h }, () => Array(level.w).fill(null));
  for (const [x, y] of level.ore) t[y][x] = 'ore';
  for (const [x, y] of level.rocks) t[y][x] = 'rock';
  const hb = level.hub;
  for (let y = hb.y; y < hb.y + hb.h; y++) for (let x = hb.x; x < hb.x + hb.w; x++) t[y][x] = 'hub';
  return t;
}
