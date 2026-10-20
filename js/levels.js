// Level definitions as data. Coordinates are [x, y] with (0,0) top-left.
// starter: buildings already on the floor when the level first loads, as [x, y, type, dir].
// dir: 0 up, 1 right, 2 down, 3 left.

export const LEVELS = [
  {
    id: 'proto',
    name: 'Gear Works',
    w: 8,
    h: 12,
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
    starter: [
      [2, 10, 'miner', 1],
      [3, 10, 'belt', 0], [3, 9, 'belt', 0],
      [3, 8, 'furnace', 0],
      [3, 7, 'belt', 0], [3, 6, 'belt', 0], [3, 5, 'belt', 0],
      [3, 4, 'belt', 0], [3, 3, 'belt', 0], [3, 2, 'belt', 0],
    ],
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
