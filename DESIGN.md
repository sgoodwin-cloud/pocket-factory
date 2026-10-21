# Pocket Factory — design and status

Last updated: 21 Oct 2026 · v4

A Factorio-style automation puzzle on a tiny grid, for the phone. Each level asks you to deliver a target rate of items to a hub; stars reward doing it in fewer tiles.

- Full design doc (concept, rules, progression, milestones): https://claude.ai/code/artifact/1eb4655e-334a-4a64-8932-81cfd215cb59
- Live game: https://sgoodwin-cloud.github.io/pocket-factory/
- Controls prototype: https://claude.ai/code/artifact/a4a85a95-dea0-4b20-ac79-bd71ce8deffd
- Test-build preview (single-file bundle of the current test branch): https://claude.ai/artifact/JhQ7eorTZh1hJcjPvQar4i

## Status

| Milestone | State |
|---|---|
| M0 Repo and offline shell | Done, 20 Oct |
| M1 Control refinements and code split | Done, 20 Oct (no control changes needed) |
| M2 Level framework, five Tier 1 levels | Done, 21 Oct (v4 play-test tweaks approved and merged) |
| M3 Logistics (underground belts, splitters, Tier 2) | Next |
| M4–M7 | Not started |

## Files

| File | Responsibility |
|---|---|
| `js/sim.js` | Grid state, whole-tick simulation, belts, machines, hub delivery, rates, hold timer and win, undo, scoring |
| `js/render.js` | Canvas drawing: terrain, grid, buildings, items, gesture overlays |
| `js/input.js` | Pointer gestures: belt drag, place and aim, tap to rotate, hold to remove |
| `js/levels.js` | Tiers and levels as data (terrain, target, tools, star budgets, starter layout, guide steps) |
| `js/ui.js` | Level select, top bar, readout, hold timer, tool tray, hints, guide, brief and level-complete cards |
| `js/save.js` | Layouts and progress in localStorage, with `SAVE_VERSION` and `migrate()` |
| `js/main.js` | Level flow, main loop, `APP_VERSION`, service worker registration and update banner |
| `sw.js` + `manifest.json` | Offline cache (`CORE` list) and home-screen install |
| `tools/verify-levels.mjs` | Proves every level is solvable at three stars, the tutorial fix works, and near-misses don't win |

## Key rules

- 20 ticks per second. Miner, furnace and assembler each take 40 ticks; a belt tile takes 8.
- **Winning:** a hold timer starts when the first target item reaches the hub after the last layout change. Keep the target rate for 45 seconds and the level is complete. While the timer runs, deliveries are counted over a sliding 30-second window (or since the timer started, if shorter, allowing one item of slack); a shortfall restarts the timer at the next delivery. Any layout change restarts it. Typical completion: about 50 seconds of game time, about 13 at 4× speed.
- **Stars:** 1 for holding the target; stars 2 and 3 are per-level rules, currently tile budgets (belts count).
- Levels unlock when the previous level has a star, or with the "Unlock all levels" testing switch.

## Save format (`SAVE_VERSION` 1)

- `pocketfactory.v1.progress`: `{ v, best: { levelId: stars }, last, unlockAll }`
- `pocketfactory.v1.layout.<levelId>`: rows of `[type, dir]` or `null`
- v0 (M2, before versioning) had no `v` or `unlockAll`; `migrate()` adds them.

## Release process

1. Make the change; run `node tools/verify-levels.mjs`.
2. Bump `APP_VERSION` (`js/main.js`) and `VERSION` (`sw.js`); add new files to `CORE`.
3. Test headlessly at 390 × 763: play through, screenshots, offline reload, update from the previous version.
4. Push to a test branch and publish a preview artifact (a single-file bundle) for Stuart.
5. Merge to `main` after he approves. On the phone: open with signal → "Update ready" banner → tap.
6. Update this file in the same commit.

## Decision log

| Date | Decision |
|---|---|
| 20 Oct 2026 | Name Pocket Factory, repo `pocket-factory`. No control refinements needed after prototype testing |
| 20 Oct 2026 | Simulation moved to whole ticks so win checks count exactly |
| 20 Oct 2026 | Level sizes vary up to 8×12; star rules set per level (provisional: tile budgets) |
| 20 Oct 2026 | Speed button (1×/2×/4×) added; Reset progress (two taps) added for play-testing |
| 21 Oct 2026 | v4: hold time halved (about 92 s → about 50 s game time) and made a visible 45-second timer; level 1 teaches the timer; level 2 starts with a line delivering ore and teaches removing a belt; level brief card on first entry and from the level title; "Unlock all levels" switch; brought in line with the app playbook (update banner, version on screen, versioned saves, `DESIGN.md`, `CLAUDE.md`, test-branch releases) |
| 21 Oct 2026 | v4 approved after preview testing; `m2-tweaks` merged to `main`. M2 complete |
