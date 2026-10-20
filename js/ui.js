// Readout, tool tray, hints and action buttons. Level select and menus arrive in M2.
import { rate, undo, clearFloor } from './sim.js';
import { saveLayout } from './save.js';

export const HINTS = {
  belt: '<b>Belt.</b> Drag to lay a path. Tap a belt to turn it. Hold anything to remove it.',
  miner: '<b>Miner</b> · 1 ore every 2 s, must sit on ore. Tap to place, or press and drag to aim.',
  furnace: '<b>Furnace</b> · 1 ore → 1 plate every 2 s. Press and drag to aim its output.',
  assembler: '<b>Assembler</b> · 2 plates → 1 gear every 2 s. Press and drag to aim its output.',
  erase: '<b>Remove.</b> Tap or drag across tiles to clear them.',
};

const $ = id => document.getElementById(id);
const cap = s => s[0].toUpperCase() + s.slice(1);

export function createUI(game) {
  const ui = { tool: 'belt' };
  const { target } = game.level;

  $('rate-label').textContent = `${cap(target.item)}s delivered to hub`;
  $('target').textContent = target.rate;

  ui.setHint = (html, err) => {
    const h = $('hint');
    h.innerHTML = html;
    h.classList.toggle('err', !!err);
  };

  ui.updateButtons = () => {
    $('undo').disabled = !game.undo.length;
    $('pause').textContent = game.running ? 'Pause' : 'Run';
  };
  game.onChange = ui.updateButtons;

  document.querySelectorAll('.tool').forEach(b =>
    b.addEventListener('click', () => {
      ui.tool = b.dataset.tool;
      document.querySelectorAll('.tool').forEach(o => o.classList.toggle('on', o === b));
      ui.setHint(HINTS[ui.tool]);
    })
  );
  $('undo').onclick = () => {
    if (!undo(game)) return;
    saveLayout(game); ui.updateButtons(); ui.setHint('<b>Undone.</b>');
  };
  $('pause').onclick = () => { game.running = !game.running; ui.updateButtons(); };
  $('clear').onclick = () => {
    clearFloor(game);
    saveLayout(game); ui.updateButtons(); ui.setHint('<b>Floor cleared.</b> Undo brings it back.');
  };

  ui.hud = () => {
    const gr = rate(game, target.item);
    $('rate').textContent = Math.round(gr);
    $('plates').textContent = Math.round(rate(game, 'plate'));
    $('ores').textContent = Math.round(rate(game, 'ore'));
    $('barfill').style.width = Math.min(100, (gr / target.rate) * 100) + '%';
    const met = gr >= target.rate - 0.5 && game.simTime > 20;
    $('bar').classList.toggle('met', met);
    $('chip').hidden = !met;
  };

  ui.setHint(HINTS.belt);
  ui.updateButtons();
  return ui;
}
