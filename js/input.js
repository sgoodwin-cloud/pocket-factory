// Pointer gestures: belt drag, place and aim, tunnel drag, tap to inspect or rotate, hold to remove.
import { DX, DY, DIRNAME, NAME, WHY, TUNNEL_MAX, cell, inB, canPlace, beginChange, removeAt, tunnelProblem, placeTunnel, isMachine } from './sim.js';
import { HOLD_MS } from './render.js';
import { HINTS } from './ui.js';
import { saveLayout } from './save.js';

// Direction of one grid step from a toward b (the larger axis wins).
const stepDir = (ddx, ddy) => (Math.abs(ddx) >= Math.abs(ddy) ? (ddx > 0 ? 1 : 3) : (ddy > 0 ? 2 : 0));
// Tools placed with a single tap and no facing.
const UNAIMED = ['cross', 'split'];

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
    else { beginChange(game); game.grid[y][x] = cell('belt', d, undefined, game.tick); g.count++; }
  }

  function eraseAt(x, y) {
    if (inB(game, x, y) && game.grid[y][x]) { beginChange(game); removeAt(game, x, y); g.count++; }
  }

  // Tapping something already placed: belts turn; machines are inspected on the first tap and
  // turn on the next; logistics pieces are inspected.
  function tapPlaced(c, x, y) {
    if (c.t === 'belt') {
      beginChange(game); c.d = (c.d + 1) % 4;
      ui.select(null);
      ui.setHint(`<b>Belt</b> now runs ${DIRNAME[c.d]}.`);
    } else if (isMachine(c.t) && ui.isSelected(x, y)) {
      beginChange(game); c.d = (c.d + 1) % 4;
      ui.select(x, y);
    } else {
      ui.select(x, y);
    }
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
      dir: tool === 'belt' ? beltDir : UNAIMED.includes(tool) ? 0 : defaultDir,
      hold: false, held: false, ghost: false, tunnel: false, end: null,
    };
    const occ = inB(game, p.x, p.y) && game.grid[p.y][p.x];
    if (tool === 'erase') { ui.select(null); eraseAt(p.x, p.y); return; }
    if (occ) {
      g.hold = true;
      g.holdTimer = setTimeout(() => {
        if (g && !g.moved) {
          beginChange(game);
          const t = removeAt(game, g.x, g.y);
          g.held = true;
          ui.select(null);
          buzz();
          ui.setHint(`<b>${t === 'tin' || t === 'tout' ? 'Tunnel' : NAME[t]} removed.</b>`);
          saveLayout(game);
        }
      }, HOLD_MS);
    } else if (tool === 'tunnel') {
      ui.select(null);
      g.tunnel = true;
      const why = canPlace(game, p.x, p.y, 'tin');
      if (why) { g.tunnelBad = WHY[why]; ui.setHint(`<b>Can't start a tunnel here.</b> ${WHY[why]}`, true); }
      else ui.setHint(HINTS.tunnel);
    } else if (tool !== 'belt') {
      ui.select(null);
      g.ghost = true;
      const why = canPlace(game, p.x, p.y, tool);
      g.ghostBad = !!why;
      ui.setHint(why
        ? `<b>Can't place here.</b> ${WHY[why]}`
        : UNAIMED.includes(tool) ? `Release to place the ${NAME[tool].toLowerCase()}.`
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
    } else if (g.tunnel && !g.tunnelBad) {
      // snap to a straight line along the main axis of the drag, at most TUNNEL_MAX tiles
      const ddx = p.x - g.x, ddy = p.y - g.y;
      const horiz = Math.abs(ddx) >= Math.abs(ddy);
      const n = Math.min(TUNNEL_MAX, Math.abs(horiz ? ddx : ddy));
      if (n === 0) { g.end = null; return; }
      const s = Math.sign(horiz ? ddx : ddy);
      g.end = horiz ? { x: g.x + s * n, y: g.y } : { x: g.x, y: g.y + s * n };
      g.tunnelWhy = inB(game, g.end.x, g.end.y) ? tunnelProblem(game, g.x, g.y, g.end.x, g.end.y) : WHY.off;
      ui.setHint(g.tunnelWhy
        ? `<b>Can't tunnel there.</b> ${g.tunnelWhy}`
        : `Release for a tunnel heading ${DIRNAME[stepDir(s * horiz, s * !horiz)]}, ${n - 1} tile${n === 2 ? '' : 's'} underground.`, !!g.tunnelWhy);
    } else if (g.ghost && !UNAIMED.includes(g.tool)) {
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
      if (occ && !g.moved && g.tool !== 'erase') {
        tapPlaced(occ, x, y);
      } else if (g.tool === 'belt') {
        if (!g.moved) {
          const why = canPlace(game, x, y, 'belt');
          if (why) ui.setHint(`<b>Can't place here.</b> ${WHY[why]}`, true);
          else { layBelt(x, y, beltDir); ui.setHint(HINTS.belt); }
        } else { beltDir = g.dir; ui.setHint(HINTS.belt); }
      } else if (g.tunnel) {
        if (g.end && !g.tunnelWhy && !g.tunnelBad) {
          beginChange(game);
          placeTunnel(game, x, y, g.end.x, g.end.y);
          buzz();
          ui.setHint('<b>Tunnel placed.</b> Items go in the entrance and come up at the exit. Anything can sit on the tiles between.');
        } else if (!g.end && !g.tunnelBad) {
          ui.setHint(HINTS.tunnel);
        }
      } else if (g.ghost && !g.ghostBad) {
        beginChange(game);
        game.grid[y][x] = cell(g.tool, g.dir, undefined, game.tick);
        buzz();
        if (UNAIMED.includes(g.tool)) ui.setHint(`<b>${NAME[g.tool]} placed.</b>`);
        else {
          defaultDir = g.dir;
          ui.setHint(`<b>${NAME[g.tool]} placed</b>, output ${DIRNAME[g.dir]}. Tap it to see its rates.`);
        }
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
