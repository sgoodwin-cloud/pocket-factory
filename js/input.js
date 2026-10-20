// Pointer gestures: belt drag, place and aim, tap to rotate, hold to remove.
import { DX, DY, DIRNAME, NAME, RECIPE, WHY, cell, inB, canPlace, beginChange } from './sim.js';
import { HOLD_MS } from './render.js';
import { HINTS } from './ui.js';
import { saveLayout } from './save.js';

// Direction of one grid step from a toward b (the larger axis wins).
const stepDir = (ddx, ddy) => (Math.abs(ddx) >= Math.abs(ddy) ? (ddx > 0 ? 1 : 3) : (ddy > 0 ? 2 : 0));

export function attachInput(cv, game, renderer, ui) {
  let g = null;           // the gesture in progress
  let defaultDir = 0;     // facing for the next tapped machine
  let beltDir = 0;        // facing for the next tapped belt

  const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* no-op */ } };

  function layBelt(x, y, d) {
    if (canPlace(game, x, y, 'belt')) return;
    const c = game.grid[y][x];
    if (c && c.t !== 'belt') return;
    if (c) { if (c.d !== d) { beginChange(game); c.d = d; } }
    else { beginChange(game); game.grid[y][x] = cell('belt', d); g.count++; }
  }

  function eraseAt(x, y) {
    if (inB(game, x, y) && game.grid[y][x]) { beginChange(game); game.grid[y][x] = null; g.count++; }
  }

  function describe(c) {
    if (c.t === 'belt') return `<b>Belt</b> now runs ${DIRNAME[c.d]}.`;
    const r = RECIPE[c.t];
    const inv = r.in ? ` · ${c.inv}/${r.cap} ${r.in} queued` : '';
    return `<b>${NAME[c.t]}</b> outputs ${DIRNAME[c.d]} · ${c.status}${inv}`;
  }

  cv.addEventListener('pointerdown', e => {
    if (g) return;
    cv.setPointerCapture(e.pointerId);
    const p = renderer.tileAt(e);
    const tool = ui.tool;
    game.gestureSnap = false;
    g = {
      id: e.pointerId, tool, x: p.x, y: p.y, sx: p.fx, sy: p.fy,
      last: { x: p.x, y: p.y }, cur: { x: p.x, y: p.y },
      moved: false, count: 0, t0: performance.now(),
      dir: tool === 'belt' ? beltDir : defaultDir,
      hold: false, held: false, ghost: false,
    };
    const occ = inB(game, p.x, p.y) && game.grid[p.y][p.x];
    if (tool === 'erase') { eraseAt(p.x, p.y); return; }
    if (occ) {
      g.hold = true;
      g.holdTimer = setTimeout(() => {
        if (g && !g.moved) {
          beginChange(game);
          const t = game.grid[g.y][g.x].t;
          game.grid[g.y][g.x] = null;
          g.held = true;
          buzz();
          ui.setHint(`<b>${NAME[t]} removed.</b>`);
          saveLayout(game);
        }
      }, HOLD_MS);
    } else if (tool !== 'belt') {
      g.ghost = true;
      const why = canPlace(game, p.x, p.y, tool);
      g.ghostBad = !!why;
      ui.setHint(why
        ? `<b>Can't place here.</b> ${WHY[why]}`
        : `Release to place ${NAME[tool].toLowerCase()} facing ${DIRNAME[g.dir]}. Drag to aim.`, !!why);
    }
  });

  cv.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const p = renderer.tileAt(e);
    g.cur = { x: p.x, y: p.y };
    const dx = p.fx - g.sx, dy = p.fy - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > 0.35) { g.moved = true; clearTimeout(g.holdTimer); }
    if (g.held) return;
    if (g.tool === 'belt' && g.moved) {
      // walk tile by tile from last to current so fast drags leave no gaps
      let a = { ...g.last };
      while (a.x !== p.x || a.y !== p.y) {
        const d = stepDir(p.x - a.x, p.y - a.y);
        const b = { x: a.x + DX[d], y: a.y + DY[d] };
        layBelt(a.x, a.y, d);
        layBelt(b.x, b.y, d);
        g.dir = d;
        a = b;
      }
      g.last = a;
      ui.setHint(`Laying belt · ${g.count} new tile${g.count === 1 ? '' : 's'}, heading ${DIRNAME[g.dir]}`);
    } else if (g.tool === 'erase') {
      let a = { ...g.last };
      while (a.x !== p.x || a.y !== p.y) {
        const d = stepDir(p.x - a.x, p.y - a.y);
        a = { x: a.x + DX[d], y: a.y + DY[d] };
        eraseAt(a.x, a.y);
      }
      g.last = a;
    } else if (g.ghost) {
      // aim relative to tile centre
      const cx = p.fx - (g.x + 0.5), cy = p.fy - (g.y + 0.5);
      if (Math.hypot(cx, cy) > 0.45) g.dir = stepDir(cx, cy);
      if (!g.ghostBad) ui.setHint(`Release to place ${NAME[g.tool].toLowerCase()} facing <b>${DIRNAME[g.dir]}</b>.`);
    }
  });

  function endGesture(e, cancel) {
    if (!g || e.pointerId !== g.id) return;
    clearTimeout(g.holdTimer);
    if (!cancel && !g.held) {
      const { x, y } = g;
      const occ = inB(game, x, y) ? game.grid[y][x] : null;
      if (g.tool === 'belt') {
        if (!g.moved) {
          if (occ) { beginChange(game); occ.d = (occ.d + 1) % 4; ui.setHint(describe(occ)); }
          else {
            const why = canPlace(game, x, y, 'belt');
            if (why) ui.setHint(`<b>Can't place here.</b> ${WHY[why]}`, true);
            else { layBelt(x, y, beltDir); ui.setHint(HINTS.belt); }
          }
        } else { beltDir = g.dir; ui.setHint(HINTS.belt); }
      } else if (g.tool !== 'erase') {
        if (g.ghost) {
          if (!g.ghostBad) {
            beginChange(game);
            game.grid[y][x] = cell(g.tool, g.dir);
            defaultDir = g.dir;
            buzz();
            ui.setHint(`<b>${NAME[g.tool]} placed</b>, output ${DIRNAME[g.dir]}. Tap it to turn it.`);
          }
        } else if (occ && !g.moved) { beginChange(game); occ.d = (occ.d + 1) % 4; ui.setHint(describe(occ)); }
      }
    }
    if (game.gestureSnap) saveLayout(game);
    g = null;
  }

  cv.addEventListener('pointerup', e => endGesture(e, false));
  cv.addEventListener('pointercancel', e => endGesture(e, true));
  document.addEventListener('gesturestart', e => e.preventDefault());
  cv.addEventListener('contextmenu', e => e.preventDefault());

  return { gesture: () => g };
}
