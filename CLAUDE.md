# Pocket Factory — notes for Claude

Read `DESIGN.md` first. It holds the milestone status, code structure, save format, release process and decision log. The full design doc is Stuart's Claude doc linked from `DESIGN.md`; the cross-app rules are in the "Artifact App Development" project's `web-app-playbook.md`.

- Plain HTML/CSS/JS ES modules on one canvas, no build step. Keep it fully offline: no runtime network calls, fonts bundled in `fonts/`.
- On every release, bump `APP_VERSION` in `js/main.js` and `VERSION` in `sw.js` together. Add any new file to `CORE` in `sw.js`.
- The simulation counts whole ticks (20 per second). Never switch timers or win checks to floating-point seconds.
- Target rates must be even (the win check counts deliveries in a 30-second window).
- Every level needs a proven solution in `tools/verify-levels.mjs` (layouts in the text format of `js/layout.js`); run `node tools/test-sim.mjs` and `node tools/verify-levels.mjs` after any change to levels or the simulation. Star 3's budget should match the best known solution.
- Releases go to a test branch first, with a preview artifact for Stuart; merge to `main` only after he approves.
- Saves carry `SAVE_VERSION` (`js/save.js`); upgrade old saves in `migrate()`, never wipe them.
- Never `preventDefault()` touches outside the canvas; keep the global `[hidden]` rule; no `alert()`/`confirm()`.
- Guide steps and hints must fit their boxes at 390 px (guide: three lines; hint: two), or the floor jumps between steps.
- Test headlessly at 390 × 763 (Stuart's iPhone 13 as a home-screen app): play a level, look at screenshots, reload offline.
- Update `DESIGN.md` (status, decision log, last updated) in the same commit as the change.
- UK spelling throughout. Commit as Stuart Goodwin.
