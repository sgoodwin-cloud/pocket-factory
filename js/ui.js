// Screens and HUD: level select, top bar, readout, tool tray, hints, guide, level-complete card.
import { rate, undo, clearFloor, stats, ruleMet, verifyProgress, TPS, WINDOW_TICKS } from './sim.js';
import { LEVELS, TIERS, PLURAL } from './levels.js';
import { saveLayout } from './save.js';

export const HINTS = {
  belt: '<b>Belt.</b> Drag to lay a path. Tap a belt to turn it. Hold anything to remove it.',
  miner: '<b>Miner</b> · 1 ore every 2 s, must sit on ore. Tap to place, or press and drag to aim.',
  furnace: '<b>Furnace</b> · 1 ore → 1 plate every 2 s. Press and drag to aim its output.',
  assembler: '<b>Assembler</b> · 2 plates → 1 gear every 2 s. Press and drag to aim its output.',
  erase: '<b>Remove.</b> Tap or drag across tiles to clear them.',
};

const SPEEDS = [1, 2, 4];
const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const LOCK = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

const $ = id => document.getElementById(id);
const cap = s => s[0].toUpperCase() + s.slice(1);
export const star = on => `<svg class="star${on ? ' on' : ''}" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>`;
const stars = (n, of = 3) => Array.from({ length: of }, (_, i) => star(i < n)).join('');
const ruleText = r => (r.tiles != null ? `≤ ${r.tiles} tiles` : `≤ ${r.buildings} machines`);

export function isUnlocked(progress, i) {
  return i === 0 || (progress.best[LEVELS[i - 1].id] || 0) >= 1;
}

export function createUI(game, actions) {
  const ui = { tool: 'belt', guideStep: 0, guideOn: false };

  ui.setHint = (html, err) => {
    const h = $('hint');
    h.innerHTML = html;
    h.classList.toggle('err', !!err);
  };

  ui.updateButtons = () => {
    $('undo').disabled = !game.undo.length;
    $('pause').textContent = game.running ? 'Pause' : 'Run';
    $('speed').textContent = `${game.speed}×`;
  };
  game.onChange = ui.updateButtons;

  function selectTool(name) {
    ui.tool = name;
    document.querySelectorAll('.tool').forEach(o => o.classList.toggle('on', o.dataset.tool === name));
    ui.setHint(HINTS[name]);
  }

  document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => selectTool(b.dataset.tool)));
  $('undo').onclick = () => {
    if (!undo(game)) return;
    saveLayout(game); ui.updateButtons(); ui.setHint('<b>Undone.</b>');
  };
  $('pause').onclick = () => { game.running = !game.running; ui.updateButtons(); };
  $('speed').onclick = () => {
    game.speed = SPEEDS[(SPEEDS.indexOf(game.speed) + 1) % SPEEDS.length];
    ui.updateButtons();
  };
  $('clear').onclick = () => {
    clearFloor(game);
    saveLayout(game); ui.updateButtons(); ui.setHint('<b>Floor cleared.</b> Undo brings it back.');
  };
  $('back').onclick = () => actions.showLevels();

  // ---------- play screen ----------
  ui.enterLevel = (index, best, showGuide) => {
    const lv = game.level;
    $('lv-num').textContent = index + 1;
    $('lv-name').textContent = lv.name;
    $('lv-best').innerHTML = stars(best);
    $('rate-label').textContent = `${cap(PLURAL[lv.target.item])} delivered to hub`;
    $('target').textContent = lv.target.rate;
    document.querySelectorAll('.tool').forEach(b => {
      b.hidden = b.dataset.tool !== 'erase' && !lv.tools.includes(b.dataset.tool);
    });
    selectTool(lv.tools.includes(ui.tool) ? ui.tool : 'belt');
    ui.guideOn = !!(showGuide && lv.guide);
    ui.guideStep = 0;
    $('guide').hidden = !ui.guideOn;
    if (!ui.guideOn) ui.setHint(lv.brief);
    ui.updateButtons();
    ui.hud();
  };

  ui.setBest = n => { $('lv-best').innerHTML = stars(n); };

  function guideDone(cond) {
    if (cond === 'delivered') return game.hubTotal > 0;
    if (cond === 'win') return game.wonSinceChange;
    if (cond.startsWith('has:')) {
      const t = cond.slice(4);
      return game.grid.some(r => r.some(c => c && c.t === t));
    }
    return false;
  }

  function updateGuide() {
    if (!ui.guideOn) return;
    const steps = game.level.guide;
    while (ui.guideStep < steps.length && guideDone(steps[ui.guideStep].until)) ui.guideStep++;
    if (ui.guideStep >= steps.length) { ui.guideOn = false; $('guide').hidden = true; return; }
    const html = steps[ui.guideStep].text;
    if ($('guide').innerHTML !== html) $('guide').innerHTML = html;
  }

  ui.hud = () => {
    const lv = game.level, t = lv.target;
    const r = rate(game, t.item);
    $('rate').textContent = Math.round(r);
    $('barfill').style.width = Math.min(100, (r / t.rate) * 100) + '%';

    const s = stats(game);
    const rules = lv.stars.map((rule, i) =>
      `<div class="${ruleMet(rule, s) ? 'ok' : ''}">${star(true)}${i + 2} ${ruleText(rule)}</div>`).join('');
    const html = `<div>${s.tiles} tile${s.tiles === 1 ? '' : 's'} · ${s.buildings} machine${s.buildings === 1 ? '' : 's'}</div>${rules}`;
    if ($('rules').innerHTML !== html) $('rules').innerHTML = html;

    // verification status
    const v = $('verify');
    const settled = game.tick - game.changeTick >= WINDOW_TICKS;
    let text = '', cls = '';
    if (game.wonSinceChange) { text = 'Target held'; cls = 'on'; }
    else if (game.holdTicks > 0 || (!settled && game.windowCount > 0)) {
      text = `Verifying · ${Math.floor(verifyProgress(game) * 100)}%`; cls = 'on';
    } else if (settled && game.windowCount > 0) {
      text = `Short · ${game.windowCount}/${t.rate} last min`; cls = 'short';
    }
    v.textContent = text;
    v.className = 'verify' + (cls ? ' ' + cls : '');
    $('bar').classList.toggle('met', cls === 'on');

    updateGuide();
  };

  // ---------- level select ----------
  ui.renderLevels = progress => {
    let total = 0, html = '', nextMarked = false;
    for (const tier of TIERS) {
      html += `<div class="tier"><h2>Tier ${tier.id} · ${tier.name}</h2></div>`;
      LEVELS.forEach((lv, i) => {
        if (lv.tier !== tier.id) return;
        const best = progress.best[lv.id] || 0;
        total += best;
        const open = isUnlocked(progress, i);
        const isNext = open && best === 0 && !nextMarked;
        if (isNext) nextMarked = true;
        html += `<button class="lv${open ? '' : ' locked'}${isNext ? ' next' : ''}" data-i="${i}" ${open ? '' : 'aria-disabled="true"'}>
          <span class="n">${i + 1}</span>
          <span><div class="nm">${lv.name}</div><div class="br">${open ? lv.brief : 'Earn a star on the level before to unlock.'}</div></span>
          <span class="st">${open ? stars(best) : LOCK}</span>
        </button>`;
      });
    }
    $('level-list').innerHTML = html;
    $('total-stars').textContent = total;
    $('max-stars').textContent = LEVELS.length * 3;
    $('level-list').querySelectorAll('.lv').forEach(b => {
      b.onclick = () => { if (!b.classList.contains('locked')) actions.openLevel(+b.dataset.i); };
    });
  };

  // Reset needs a second tap within a few seconds, so it can't happen by accident.
  let resetTimer = null;
  const resetBtn = $('reset');
  const disarm = () => { clearTimeout(resetTimer); resetBtn.classList.remove('armed'); resetBtn.textContent = 'Reset progress'; };
  resetBtn.onclick = () => {
    if (!resetBtn.classList.contains('armed')) {
      resetBtn.classList.add('armed');
      resetBtn.textContent = 'Tap again to erase all stars and layouts';
      resetTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    actions.resetProgress();
    resetBtn.textContent = 'Progress reset';
    resetTimer = setTimeout(disarm, 2000);
  };

  ui.showScreen = name => {
    $('levels').hidden = name !== 'levels';
    $('play').hidden = name !== 'play';
  };

  // ---------- level complete ----------
  ui.showComplete = (score, prevBest, hasNext) => {
    const lv = game.level, t = lv.target;
    $('done-kicker').textContent = prevBest > 0 ? 'Improved' : 'Level complete';
    $('done-title').textContent = score.stars === 3 ? 'Perfect layout' : 'Target held';
    $('done-stars').innerHTML = stars(score.stars);
    const checks = [`<li><span class="y">✓</span>${t.rate} ${PLURAL[t.item]} a minute, held steady</li>`];
    lv.stars.forEach((rule, i) => {
      const used = rule.tiles != null ? `${score.stats.tiles} tiles` : `${score.stats.buildings} machines`;
      checks.push(`<li><span class="${score.met[i + 1] ? 'y">✓' : 'x">–'}</span>${ruleText(rule)} (you used ${used})</li>`);
    });
    $('done-checks').innerHTML = checks.join('');
    $('done-note').textContent =
      score.stars === 3 ? '' :
      prevBest > 0 ? `New best: ${score.stars} stars.` :
      'Come back and tighten the layout for the rest.';
    $('done-next').textContent = hasNext ? 'Next level' : 'All levels';
    $('complete').hidden = false;
  };
  $('done-stay').onclick = () => { $('complete').hidden = true; };
  $('done-next').onclick = () => { $('complete').hidden = true; actions.next(); };

  return ui;
}
