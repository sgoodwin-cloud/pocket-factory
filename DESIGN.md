# Pocket Factory — design and status

Last updated: 21 Oct 2026 · v6

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
| M3 Logistics (tunnels, crossings, splitters, Tier 2) | Done, 21 Oct (v5 approved and merged) |
| M4 Copper and circuits | Done, 21 Oct (v6 approved and merged) |
| M5 Feel and polish | Next |
| M6–M7 | Not started |

## Files

| File | Responsibility |
|---|---|
| `js/sim.js` | Grid state, whole-tick simulation (belts, tunnels, crossings, splitters, machines), hub delivery, rates, hold timer and win, undo, scoring, per-machine rates |
| `js/render.js` | Canvas drawing: terrain, grid, buildings, items, gesture overlays |
| `js/input.js` | Pointer gestures: belt drag, place and aim, tunnel drag, tap to inspect or rotate, hold to remove |
| `js/levels.js` | Tiers and levels as data (text maps or coordinates, target, tools, star budgets, starter layout, guide steps) |
| `js/layout.js` | Text layout format (two-character tokens) for starters, solutions and tests |
| `js/ui.js` | Level select, top bar, readout, hold timer, tool tray, hints, guide, brief and level-complete cards |
| `js/save.js` | Layouts and progress in localStorage, with `SAVE_VERSION` and `migrate()` |
| `js/main.js` | Level flow, main loop, `APP_VERSION`, service worker registration and update banner |
| `sw.js` + `manifest.json` | Offline cache (`CORE` list) and home-screen install |
| `tools/verify-levels.mjs` | Proves every level is solvable at three stars, tutorial fixes work, no-tunnel routes stop short of three stars, and near-misses don't win |
| `tools/test-sim.mjs` | Mechanics tests: full belts in every direction, tunnels, crossings, splitters, tunnel saving and removal |

## Key rules

- 20 ticks per second. Miner, furnace and assembler each take 40 ticks; a belt tile takes 8, so a full belt carries 150 items a minute.
- Each tick advances every timer, then moves items, resolving whatever an item moves into first, so a full line moves together whichever way it points.
- **Tunnels:** dragged from entrance to exit in a straight line, up to 4 tiles underground (5 apart). Items travel at belt speed; the tiles in between stay free. Only the two ends count as tiles. Removing either end removes both.
- **Crossings:** one tile with a vertical and a horizontal lane; items keep going straight.
- **Splitters:** take one item at a time from any side and hand it to the next neighbour round the clockwise order that will accept it, never back the way it came.
- **Items and recipes:** iron ore → iron plate and copper ore → copper plate in a furnace; assembler recipes are gear (2 iron plates → 1 gear), wire (1 copper plate → 2 wire) and circuit (1 iron plate + 2 wire → 1 circuit). Every machine works in 2-second cycles, so 30 circuits a minute needs one iron line, one copper line, one wire assembler and one circuit assembler. Factorio uses 3 wire per circuit; 2 keeps whole-number ratios on a tiny grid (revisit in M7).
- **Furnaces** smelt whichever ore arrives, but one kind at a time: while holding iron they refuse copper, so a mixed belt waits its turn.
- **Assemblers** have a recipe each, chosen from chips under the hint line when the Assemble tool or a placed assembler is selected (only on levels with more than one recipe). They take each ingredient from any side but their output and hold up to three batches of each. A machine starts its next batch as soon as fewer than one batch's output is still waiting to leave, so a wire assembler keeps up with its belt.
- **Inspect:** tap a machine to see its output per minute, input use and how busy it is; tap again to turn it. Belts still turn on the first tap.
- **Winning:** a hold timer starts when the first target item reaches the hub after the last layout change. Keep the target rate for 45 seconds and the level is complete. While the timer runs, deliveries are counted over a sliding 30-second window (or since the timer started, if shorter, allowing one item of slack); a shortfall restarts the timer at the next delivery. Any layout change restarts it. Typical completion: about 50 seconds of game time, about 13 at 4× speed.
- **Stars:** 1 for holding the target; stars 2 and 3 are per-level rules, currently tile budgets (belts count).
- Levels unlock when the previous level has a star, or with the "Unlock all levels" testing switch.

## Save format (`SAVE_VERSION` 1)

- `pocketfactory.v1.progress`: `{ v, best: { levelId: stars }, last, unlockAll }`
- `pocketfactory.v1.layout.<levelId>`: rows of `[type, dir]` or `null`; tunnel ends (`tin`/`tout`, from v5) add a third value, the tunnel length; assemblers with a recipe other than gear (from v6) add the recipe. Additive, so no version bump was needed
- v0 (M2, before versioning) had no `v` or `unlockAll`; `migrate()` adds them.

## Release process

1. Make the change; run `node tools/test-sim.mjs` and `node tools/verify-levels.mjs`.
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
| 21 Oct 2026 | M3 design: both tunnels and crossings plus an auto-splitter (Stuart's choice). Tapping a machine now inspects it and a second tap turns it. Full belts fixed to move as one line in every direction |
| 21 Oct 2026 | v5: Assembly Line added to Tier 1; Tier 2 Logistics with eight levels (three guided tutorials: Under the Wall, Crossroads, Fork). 14 levels in all. Tutorial banner given a fixed height so the floor doesn't jump between steps |
| 21 Oct 2026 | v5 approved after preview testing; `m3` merged to `main`. M3 complete |
| 21 Oct 2026 | M4 design: 2 wire per circuit (not Factorio's 3) for whole-number ratios; furnaces lock to one ore at a time; recipe chips rather than a menu. Tier 3 Copper with six levels (two guided: Wire Works, First Circuit), 20 levels in all |
| 21 Oct 2026 | Every guide step must fit three lines at 390 px: six were four lines, which made the floor jump between steps; all shortened |
| 21 Oct 2026 | v6 approved after preview testing; `m4` merged to `main`. M4 complete |
