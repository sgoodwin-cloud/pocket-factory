// Entry point: level flow, progress and the main loop.
import { LEVELS } from './levels.js';
import { createGame, setLevel, step, STEP } from './sim.js';
import { createRenderer } from './render.js';
import { createUI, isUnlocked } from './ui.js';
import { attachInput } from './input.js';
import { loadSavedLayout, saveLayout, loadProgress, saveProgress } from './save.js';

const progress = loadProgress();
let current = 0;
let playing = false;

const game = createGame(LEVELS[0]);
const cv = document.getElementById('cv');
const renderer = createRenderer(cv, document.getElementById('floor'), game);

const actions = {
  openLevel(i) {
    if (!isUnlocked(progress, i)) return;
    if (playing) saveLayout(game);
    current = i;
    setLevel(game, LEVELS[i]);
    loadSavedLayout(game);
    game.running = true;
    progress.last = LEVELS[i].id;
    saveProgress(progress);
    const best = progress.best[LEVELS[i].id] || 0;
    ui.showScreen('play');
    renderer.fit();
    ui.enterLevel(i, best, best === 0);
    playing = true;
  },
  showLevels() {
    if (playing) saveLayout(game);
    playing = false;
    ui.renderLevels(progress);
    ui.showScreen('levels');
  },
  next() {
    if (current + 1 < LEVELS.length && isUnlocked(progress, current + 1)) actions.openLevel(current + 1);
    else actions.showLevels();
  },
};

const ui = createUI(game, actions);
const input = attachInput(cv, game, renderer, ui);

game.onWin = score => {
  const id = game.level.id;
  const prev = progress.best[id] || 0;
  if (score.stars > prev) {
    progress.best[id] = score.stars;
    saveProgress(progress);
    ui.setBest(score.stars);
    ui.showComplete(score, prev, current + 1 < LEVELS.length);
  } else {
    ui.setHint(`<b>Target held again.</b> Best is still ${prev} star${prev === 1 ? '' : 's'}.`);
  }
};

actions.showLevels();

let lastT = performance.now(), acc = 0, hudT = 0;
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000);
  lastT = t;
  if (playing) {
    let animDt = 0;
    if (game.running) {
      acc += dt * game.speed;
      animDt = dt * game.speed;
      let n = 0;
      while (acc >= STEP && n < 40) { step(game); acc -= STEP; n++; }
      if (n === 40) acc = 0; // fell behind (e.g. tab in background): skip rather than spiral
    }
    renderer.draw(animDt, input.gesture());
    hudT += dt;
    if (hudT > 0.2) { ui.hud(); hudT = 0; }
  }
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
window.pf = { game, ui, progress, actions };
