// Saving and loading layouts and level progress in localStorage.
import { layout, loadLayout } from './sim.js';

// Save format. Bump SAVE_VERSION when it changes and upgrade old saves in migrate(); never wipe them.
//   progress: { v, best: { [levelId]: stars }, last: levelId|null, unlockAll: bool }
//   layout.<levelId>: rows of [type, dir] or null, matching the level's grid size
export const SAVE_VERSION = 1;
const PREFIX = 'pocketfactory.v1.';
const layoutKey = levelId => `${PREFIX}layout.${levelId}`;
const PROGRESS_KEY = `${PREFIX}progress`;

function migrate(p) {
  // v0 (before versioning, M2): { best, last }
  if (!p.v) p = { ...p, v: 1, unlockAll: false };
  return p;
}

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
    if (p && typeof p === 'object' && p.best && typeof p.best === 'object') return migrate(p);
  } catch (e) { /* corrupt or unavailable */ }
  return { v: SAVE_VERSION, best: {}, last: null, unlockAll: false };
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
