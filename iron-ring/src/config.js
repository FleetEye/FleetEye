// =============================================================
//  IRON RING — config / équilibrage
//  Tout le "game feel" se règle ici. Règle d'or : chaque pièce
//  améliorée doit se SENTIR dans le combat, pas juste être un chiffre.
//    - Bras    -> dégâts (l'ennemi tombe plus vite)
//    - Jambes  -> vitesse de déplacement + esquive (tu es plus agile)
//    - Châssis -> points de vie (tu encaisses plus)
// =============================================================

export const CONFIG = {
  // Le ring : les robots restent à l'intérieur de ce rayon.
  // Volontairement serré -> plus "boxe", le combat reste bien cadré.
  arena: { radius: 4.8 },

  robot: {
    bodyRadius: 0.75, // rayon "physique" pour les collisions entre robots
    reach: 2.05,      // portée d'un coup de poing (distance centre à centre)
  },

  // Stats de base au niveau 1 + gain par niveau supplémentaire.
  stats: {
    hp:      { base: 100, perLevel: 30 },              // Châssis
    move:    { base: 3.3, perLevel: 0.45 },            // Jambes -> vitesse (u/s)
    dodgeCd: { base: 1.5, perLevel: -0.13, min: 0.55 },// Jambes -> cooldown esquive (s)
    damage:  { base: 9,   perLevel: 4 },               // Bras   -> dégâts par coup
  },

  // Timing d'un coup de poing (en secondes depuis le déclenchement).
  // La "fenêtre active" est le moment où le coup peut toucher : c'est ce qui
  // rend la garde et l'esquive tactiques (bien timer sa défense).
  punch: {
    cooldown: 0.48,
    activeFrom: 0.05,
    activeTo: 0.18,
    knockback: 1.6,
  },

  dodge: {
    duration: 0.30,  // durée du dash
    iframes: 0.24,   // temps d'invincibilité pendant le dash
    distance: 2.8,   // distance parcourue
  },

  guard: {
    damageMul: 0.25, // dégâts reçus en garde (75% bloqués)
    moveMul: 0.45,   // on se déplace plus lentement en garde
  },

  // Économie de la boucle méta (garage).
  economy: {
    scrapPerWin: (wave) => 45 + wave * 15,        // ferraille gagnée par victoire
    upgradeCost: (level) => 40 + (level - 1) * 35, // coût pour passer de `level` à level+1
    maxLevel: 8,
  },

  // Montée en puissance de l'adversaire IA à chaque vague (1-indexé).
  enemy: {
    hp:         (w) => 90 + (w - 1) * 40,
    damage:     (w) => 8 + (w - 1) * 2.5,
    move:       (w) => 2.7 + (w - 1) * 0.16,
    reaction:   (w) => Math.max(0.20, 0.70 - (w - 1) * 0.05), // délai entre décisions (s)
    aggression: (w) => Math.min(0.92, 0.60 + (w - 1) * 0.05), // proba d'attaquer en portée
    guardChance:(w) => Math.min(0.6, 0.15 + (w - 1) * 0.04),  // proba de se défendre
  },

  // Couleurs (greybox) — bleu = joueur, rouge = ennemi.
  colors: {
    player: 0x3da9fc,
    playerDark: 0x1b4965,
    enemy: 0xef476f,
    enemyDark: 0x6a1b2a,
    ring: 0x1d2633,
    ringMat: 0x11161f,
    post: 0xf4d35e,
  },
};
