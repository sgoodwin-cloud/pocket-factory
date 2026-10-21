// Level definitions as data. Coordinates are [x, y] with (0,0) top-left.
// starter: buildings already on the floor when the level first loads, as [x, y, type, dir].
// dir: 0 up, 1 right, 2 down, 3 left.
// stars: the rules for stars 2 and 3 (star 1 is hitting the target). { tiles: n } means at most
//   n occupied tiles, belts included; { buildings: n } means at most n machines.
// guide: optional step-by-step coaching, shown until the level is first completed. Each step
//   shows until its condition is met: 'has:<type>' a building of that type exists,
//   'notbelt:x,y' that tile no longer holds a belt, 'delivered' a target item reached the hub,
//   'win'. focus: 'timer' highlights the hold timer while the step shows.
// target.rate must be even (see the win rule in sim.js).
// Every level has a proven solution in tools/verify-levels.mjs.

export const PLURAL = { ore: 'ore', plate: 'plates', gear: 'gears' };

export const TIERS = [
  { id: 1, name: 'Iron' },
];

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
];

export function buildTerrain(level) {
  const t = Array.from({ length: level.h }, () => Array(level.w).fill(null));
  for (const [x, y] of level.ore) t[y][x] = 'ore';
  for (const [x, y] of level.rocks) t[y][x] = 'rock';
  const hb = level.hub;
  for (let y = hb.y; y < hb.y + hb.h; y++) for (let x = hb.x; x < hb.x + hb.w; x++) t[y][x] = 'hub';
  return t;
}
