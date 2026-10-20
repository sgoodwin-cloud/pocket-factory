// Saving and loading layouts and level progress in localStorage.
import { layout, loadLayout } from './sim.js';

const PREFIX = 'pocketfactory.v1.';
const layoutKey = levelId => `${PREFIX}layout.${levelId}`;
const PROGRESS_KEY = `${PREFIX}progress`;

export function saveLayout(game) {
  try { localStorage.setItem(layoutKey(game.level.id), JSON.stringify(layout(game))); } catch (e) { /* storage unavailable */ }
}

// Returns true if a saved layout was found and loaded.
export function loadSavedLayout(game) {
  try {
    const s = JSON.parse(localStorage.getItem(layoutKey(game.level.id)) || 'null');
    if (Array.isArray(s) && s.length === game.H && s.every(r => Array.isArray(r) && r.length === game.W)) {
      loadLayout(game, s);
      return true;
    }
  } catch (e) { /* corrupt or unavailable */ }
  return false;
}

// Progress: best stars per level id, and the last level played.
export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
    if (p && typeof p === 'object' && p.best && typeof p.best === 'object') return p;
  } catch (e) { /* corrupt or unavailable */ }
  return { best: {}, last: null };
}

// Erase every saved layout and all progress: back to a fresh install.
export function resetAll() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) { /* storage unavailable */ }
}

export function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
}
