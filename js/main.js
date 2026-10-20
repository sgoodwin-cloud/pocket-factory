// Entry point: builds the game for the current level and runs the main loop.
import { LEVELS } from './levels.js';
import { createGame, step, STEP } from './sim.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { attachInput } from './input.js';
import { loadSavedLayout } from './save.js';

const game = createGame(LEVELS[0]);
loadSavedLayout(game);

const cv = document.getElementById('cv');
const renderer = createRenderer(cv, document.getElementById('floor'), game);
const ui = createUI(game);
const input = attachInput(cv, game, renderer, ui);

let lastT = performance.now(), acc = 0, hudT = 0;
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000);
  lastT = t;
  let animDt = 0;
  if (game.running) {
    acc += dt;
    animDt = dt;
    while (acc >= STEP) { step(game, STEP); acc -= STEP; }
  }
  renderer.draw(animDt, input.gesture());
  hudT += dt;
  if (hudT > 0.25) { ui.hud(); hudT = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Offline support: cache every file on first load.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline install unavailable */ });
  });
}

// Exposed for debugging in the browser console.
window.pf = { game, ui };
