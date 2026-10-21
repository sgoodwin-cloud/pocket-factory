// Entry point: level flow, progress, the main loop, and offline support with the update banner.
// Bump APP_VERSION together with VERSION in sw.js on every release.
const APP_VERSION = '5';
import { LEVELS } from './levels.js';
import { createGame, setLevel, step, STEP } from './sim.js';
import { createRenderer } from './render.js';
import { createUI, isUnlocked } from './ui.js';
import { attachInput } from './input.js';
import { loadSavedLayout, saveLayout, loadProgress, saveProgress, resetAll } from './save.js';

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
  resetProgress() {
    resetAll();
    progress.best = {};
    progress.last = null;
    progress.unlockAll = false;
    ui.renderLevels(progress);
  },
  toggleUnlockAll() {
    progress.unlockAll = !progress.unlockAll;
    saveProgress(progress);
    ui.renderLevels(progress);
  },
  next() {
    if (current + 1 < LEVELS.length && isUnlocked(progress, current + 1)) actions.openLevel(current + 1);
    else actions.showLevels();
  },
};

const ui = createUI(game, actions);
const input = attachInput(cv, game, renderer, ui);
renderer.selected = ui.getSelected;

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

document.getElementById('ver').textContent = `v${APP_VERSION}`;
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

// Offline support + update banner (pattern proven in Swipe Snake, Flip 7 and Phase 10).
if ('serviceWorker' in navigator) {
  (async () => {
    try {
      // Only reload on a controller change if a worker was already running (an update), never on first install.
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register('sw.js');
      const btn = document.getElementById('update');
      let reloading = false;
      const reload = () => { if (!reloading) { reloading = true; if (playing) saveLayout(game); location.reload(); } };
      // Tap → tell the waiting worker to take over → reload once it has actually switched on.
      const show = w => {
        btn.hidden = false;
        btn.onclick = () => {
          const nw = reg.waiting || w;
          btn.textContent = 'Updating…'; btn.disabled = true;
          if (!nw || nw.state === 'activated') return reload();
          nw.addEventListener('statechange', () => { if (nw.state === 'activated') reload(); });
          nw.postMessage('skipWaiting');
          setTimeout(reload, 5000);
        };
      };
      // Catch an update whatever stage it's at: already waiting, mid-download, or found later.
      const track = w => {
        if (!w) return;
        const check = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); };
        check();
        w.addEventListener('statechange', check);
      };
      track(reg.waiting);
      track(reg.installing);
      reg.addEventListener('updatefound', () => track(reg.installing));
      reg.update().catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reload(); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch (e) { /* no service worker (e.g. artifact preview): the game still works */ }
  })();
}

// Exposed for debugging in the browser console.
window.pf = { game, ui, progress, actions };
