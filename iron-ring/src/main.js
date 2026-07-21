// =============================================================
//  IRON RING — orchestration
//  Enchaîne GARAGE <-> COMBAT <-> RÉSULTAT et branche la
//  progression (ferraille, niveaux de pièces, vagues).
// =============================================================

import { CONFIG } from './config.js';
import {
  loadSave, writeSave, resetSave, deriveStats,
  PARTS, upgradeCost, canUpgrade, applyUpgrade,
} from './state.js';
import { Input } from './input.js';
import { Fight } from './combat.js';

let save = loadSave();
let input = null;
let fight = null;

const $ = (id) => document.getElementById(id);

function showScreen(name) {
  for (const s of ['garage', 'fight', 'result']) {
    $(s).classList.toggle('active', s === name);
  }
}

// ------------------------------------------------------------
//  GARAGE
// ------------------------------------------------------------
function renderGarage() {
  $('scrap-count').textContent = save.scrap;
  $('wave-tag').textContent = `VAGUE ${save.wave}`;

  const wrap = $('parts');
  wrap.innerHTML = '';
  for (const part of PARTS) {
    const lvl = save[part.key];
    const cost = upgradeCost(save, part.key);
    const maxed = lvl >= CONFIG.economy.maxLevel;
    const affordable = canUpgrade(save, part.key);

    const pips = Array.from({ length: CONFIG.economy.maxLevel }, (_, i) =>
      `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('');

    const card = document.createElement('div');
    card.className = 'part-card';
    card.innerHTML = `
      <div class="part-head">
        <span class="part-icon">${part.icon}</span>
        <div>
          <div class="part-label">${part.label}</div>
          <div class="part-blurb">${part.blurb}</div>
        </div>
        <div class="part-stat">${part.stat(save)}</div>
      </div>
      <div class="pips">${pips}</div>
      <button class="up-btn" data-key="${part.key}" ${affordable ? '' : 'disabled'}>
        ${maxed ? 'MAX' : `Améliorer · ${cost} ⚙️`}
      </button>`;
    wrap.appendChild(card);
  }

  wrap.querySelectorAll('.up-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (applyUpgrade(save, key)) {
        beepUi();
        renderGarage();
      }
    });
  });
}

function beepUi() {
  try {
    const AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(); const g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = 660; g.gain.value = 0.05;
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + 0.08);
  } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------
//  COMBAT
// ------------------------------------------------------------
function startFight() {
  showScreen('fight');
  const mount = $('scene');

  const playerStats = deriveStats(save);
  const w = save.wave;
  const enemyStats = {
    maxHp: CONFIG.enemy.hp(w),
    moveSpeed: CONFIG.enemy.move(w),
    dodgeCd: 1.2,
    damage: CONFIG.enemy.damage(w),
  };

  if (!input) input = new Input();
  input.reset();

  $('fight-wave').textContent = `VAGUE ${w}`;
  setHp('hp-player', 1);
  setHp('hp-enemy', 1);

  fight = new Fight({
    mount,
    playerStats,
    enemyStats,
    wave: w,
    input,
    onHud: (pf, ef) => { setHp('hp-player', pf); setHp('hp-enemy', ef); },
    onEnd: (res) => endFight(res),
  });
  fight.start();

  banner('COMBAT !', 900);
}

function setHp(id, frac) {
  const el = $(id);
  if (el) el.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
}

function banner(text, ms) {
  const b = $('fight-banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => b.classList.remove('show'), ms);
}

function endFight(res) {
  banner(res.win ? 'K.O. !' : 'DÉTRUIT', 1200);
  setTimeout(() => {
    if (fight) { fight.dispose(); fight = null; }
    let reward = 0;
    if (res.win) {
      reward = CONFIG.economy.scrapPerWin(save.wave);
      save.scrap += reward;
      save.wave += 1;
      writeSave(save);
    }
    showResult(res.win, reward);
  }, 1300);
}

// ------------------------------------------------------------
//  RÉSULTAT
// ------------------------------------------------------------
function showResult(win, reward) {
  showScreen('result');
  $('result-title').textContent = win ? 'VICTOIRE' : 'DÉFAITE';
  $('result-title').className = win ? 'win' : 'lose';
  $('result-sub').innerHTML = win
    ? `Tu passes à la vague ${save.wave}.<br>+${reward} ⚙️ de ferraille récupérée.`
    : `L'adversaire tient encore.<br>Améliore ton robot et réessaie.`;
  $('btn-continue').textContent = win ? 'AU GARAGE' : 'RÉESSAYER';
}

// ------------------------------------------------------------
//  BOOT
// ------------------------------------------------------------
function boot() {
  renderGarage();
  showScreen('garage');

  $('btn-fight').addEventListener('click', startFight);
  $('btn-continue').addEventListener('click', () => {
    renderGarage();
    showScreen('garage');
  });
  $('btn-reset').addEventListener('click', () => {
    if (confirm('Réinitialiser toute la progression ?')) {
      save = resetSave();
      renderGarage();
    }
  });
}

boot();
