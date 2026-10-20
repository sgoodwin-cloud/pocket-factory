# Pocket Factory

A Factorio-style automation puzzle on a tiny grid, built for the phone. Plain HTML, CSS and JavaScript on a single canvas, with no build step. Installs to the home screen and runs fully offline.

## Files

| File | Responsibility |
|---|---|
| `js/sim.js` | Grid state, fixed-step tick, belts, machines, hub delivery, rates, undo |
| `js/render.js` | Canvas drawing: terrain, grid, buildings, items, overlays |
| `js/input.js` | Pointer gestures: belt drag, place and aim, tap to rotate, hold to remove |
| `js/levels.js` | Level definitions as data |
| `js/ui.js` | Readout, tool tray, hints, buttons |
| `js/save.js` | Saving and loading layouts in localStorage |
| `js/main.js` | Entry point and main loop |
| `sw.js` + `manifest.json` | Offline caching and home-screen install |

## Releasing a change

Bump `VERSION` in `sw.js` whenever any file changes, otherwise installed copies keep serving the old cached files.

## Running locally

Serve the folder (`python3 -m http.server`) and open it in a browser. ES modules don't load from `file://`.
