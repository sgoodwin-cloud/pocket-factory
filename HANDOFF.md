# Handoff: Pocket Factory (22 Oct 2026)

## Goal
Keep building Pocket Factory milestone by milestone. It's a Factorio-style puzzle on a small grid for Stuart's iPhone, delivered as an offline home-screen web app on GitHub Pages. Next up is M5, Feel and polish.

## Where we got to
- M0 to M4 are done and merged. That's 20 levels across three tiers, with tunnels, crossings, splitters, copper, wire and circuits.
- `main` is on v8 (merge `e7ca39d`), deployed and live. Stuart's phone is confirmed on v7; v8 should arrive on its own via the Update bar.
- v7 fixed updates: the "Update ready" bar now sits at the top of the page, files are fetched with `?v=` addresses, and the install checks the version.
- v8 added the install retry, which tries up to four times with fresh addresses.
- Nothing is in progress. There's no open branch with unmerged work.

## Decisions and why
- **Hold time.** The target is held for 45 s, against a 30 s check window. The timer is visible and taught in level 1, because Stuart found the earlier time too long and too opaque.
- **Testing switches.** The level-select screen has Reset progress and Unlock all levels, for play-testing.
- **Level brief.** It can be reopened via the level title (ⓘ) during play.
- **Assembler batches.** An assembler starts its next batch when `out < n`. This fixed the wire under-rate.
- **Update bar position.** The bar is never floating. A floating one couldn't be tapped on iPhone.
- **Releases.** Every release goes to a test branch with a preview artifact. Merge only after Stuart approves.

## Open items / next step
- **M5 scope** (design doc): sound, animations, a better level-complete screen, settings, tutorial hints and stats.
- **Next step:** read `DESIGN.md` and the design doc's M5 section, then ask Stuart one scoping question about which polish matters most before building.
- **Cosmetic:** the v8 merge commit is labelled "(v)". It's left as is, since fixing it would mean rewriting published history.

## Files and artifacts
- Repo: `sgoodwin-cloud/pocket-factory`. Start with `DESIGN.md`, then `CLAUDE.md`.
- Design doc: https://claude.ai/code/artifact/1eb4655e-334a-4a64-8932-81cfd215cb59
- Test-build preview, republished for each test branch: https://claude.ai/artifact/JhQ7eorTZh1hJcjPvQar4i
- Project Board: https://claude.ai/artifact/B9dyUwDBZj4wT8ruTfzaku
- Cross-app rules: the `claude/web-app-playbook.md` doc in the "Artifact App Development" Project.
- Tests: `node tools/test-sim.mjs` and `node tools/verify-levels.mjs`.

## Don't redo
- **Timing:** don't use floating-point seconds. Timing counts whole ticks.
- **Guide steps:** keep them to three lines at 390 px, or the floor jumps.
- **Testing in Safari:** WebKit can't be downloaded in the container, so test with Playwright Chromium at 390 × 763.
- **Waiting for a deploy:** wait for the GitHub deployment `success` before telling Stuart a release is live.
- **`pkill -f`:** it kills its own shell. Avoid it.

## First action
First action: use the update-project-board skill to record this handoff on the Pocket Factory card on my Project Board. Use the Where we got to and Open items sections above for the progress and next steps, and set the card's chat link to this new chat, not the previous one.
