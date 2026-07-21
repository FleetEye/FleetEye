// =============================================================
//  IRON RING — progression persistante (localStorage)
//  Niveaux des 3 pièces + ferraille + vague courante.
// =============================================================

import { CONFIG } from './config.js';

const KEY = 'iron-ring-save-v1';

const DEFAULT_SAVE = {
  arms: 1,     // Bras    -> dégâts
  legs: 1,     // Jambes  -> vitesse + esquive
  chassis: 1,  // Châssis -> PV
  scrap: 60,   // un peu de ferraille de départ pour goûter au garage
  wave: 1,     // vague / adversaire courant
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...parsed };
  } catch (e) {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {
    /* stockage indisponible : on continue sans persistance */
  }
}

export function resetSave() {
  const fresh = { ...DEFAULT_SAVE };
  writeSave(fresh);
  return fresh;
}

// Traduit les niveaux de pièces en stats de combat concrètes.
export function deriveStats(save) {
  const s = CONFIG.stats;
  return {
    maxHp: s.hp.base + (save.chassis - 1) * s.hp.perLevel,
    moveSpeed: s.move.base + (save.legs - 1) * s.move.perLevel,
    dodgeCd: Math.max(
      s.dodgeCd.min,
      s.dodgeCd.base + (save.legs - 1) * s.dodgeCd.perLevel,
    ),
    damage: s.damage.base + (save.arms - 1) * s.damage.perLevel,
  };
}

// Métadonnées d'une pièce pour l'affichage du garage.
export const PARTS = [
  {
    key: 'arms',
    label: 'Bras',
    icon: '🦾',
    blurb: 'Dégâts par coup',
    stat: (save) => `${deriveStats(save).damage.toFixed(0)} dmg`,
  },
  {
    key: 'legs',
    label: 'Jambes',
    icon: '🦿',
    blurb: 'Vitesse & esquive',
    stat: (save) => `${deriveStats(save).moveSpeed.toFixed(1)} vit.`,
  },
  {
    key: 'chassis',
    label: 'Châssis',
    icon: '🛡️',
    blurb: 'Points de vie',
    stat: (save) => `${deriveStats(save).maxHp.toFixed(0)} PV`,
  },
];

export function upgradeCost(save, key) {
  return CONFIG.economy.upgradeCost(save[key]);
}

export function canUpgrade(save, key) {
  return (
    save[key] < CONFIG.economy.maxLevel &&
    save.scrap >= upgradeCost(save, key)
  );
}

// Applique une amélioration si possible. Retourne le save (muté) ou null.
export function applyUpgrade(save, key) {
  if (!canUpgrade(save, key)) return null;
  save.scrap -= upgradeCost(save, key);
  save[key] += 1;
  writeSave(save);
  return save;
}
