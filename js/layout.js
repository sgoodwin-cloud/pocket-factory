// Text layouts, used for level starters, solutions and tests. Each row is a string of two-character tokens:
//   first: b belt, m miner, f furnace, a assembler, t tunnel entrance, T tunnel exit,
//          x crossing, s splitter, . empty
//   second: direction ^ > v <  (or . for crossings, splitters and empty tiles)
// A tunnel entrance pairs with the first exit ahead of it in the same direction.
// Spaces are ignored, so rows can be spaced out for readability.
const TYPE = { b: 'belt', m: 'miner', f: 'furnace', a: 'assembler', t: 'tin', T: 'tout', x: 'cross', s: 'split' };
const DIR = { '^': 0, '>': 1, v: 2, '<': 3, '.': 0 };
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

export function parseLayout(rows) {
  const grid = rows.map(r => {
    const s = r.replace(/ /g, '');
    if (s.length % 2) throw new Error(`odd row length: "${r}"`);
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push(s.slice(i, i + 2));
    return out;
  });
  const items = [];
  grid.forEach((row, y) => row.forEach((tok, x) => {
    if (tok === '..') return;
    const t = TYPE[tok[0]], d = DIR[tok[1]];
    if (!t || d == null) throw new Error(`bad token "${tok}" at ${x},${y}`);
    let len;
    if (t === 'tin' || t === 'tout') {
      const s = t === 'tin' ? 1 : -1, want = t === 'tin' ? 'T' : 't';
      for (let k = 1; k <= 5 && !len; k++) {
        const xx = x + DX[d] * k * s, yy = y + DY[d] * k * s;
        const o = grid[yy] && grid[yy][xx];
        if (o && o[0] === want && DIR[o[1]] === d) len = k;
      }
      if (!len) throw new Error(`unpaired tunnel at ${x},${y}`);
    }
    items.push([x, y, t, d, len]);
  }));
  return items;
}
