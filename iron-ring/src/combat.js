// =============================================================
//  IRON RING — combat (Three.js)
//  Duel 1v1 temps réel dans un ring. Vue top-down inclinée.
//  Robots en greybox (boîtes). La logique est séparée du rendu
//  pour pouvoir brancher de vrais modèles plus tard.
// =============================================================

import * as THREE from 'three';
import { CONFIG } from './config.js';

const PUNCH_ANIM = 0.26; // durée visuelle d'un coup (s)

// ---- petits sons WebAudio (aucun asset) --------------------
let AC = null;
function beep(freq, dur, type = 'square', gain = 0.05) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(AC.destination);
    const t = AC.currentTime;
    o.start(t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.stop(t + dur);
  } catch (e) { /* audio indisponible */ }
}
const sfx = {
  swing: () => beep(220, 0.06, 'square', 0.03),
  hit:   () => beep(120, 0.12, 'sawtooth', 0.07),
  block: () => beep(320, 0.05, 'triangle', 0.05),
  dodge: () => beep(520, 0.07, 'sine', 0.03),
  ko:    () => { beep(180, 0.5, 'sawtooth', 0.09); },
};

// ---- fabrique d'un robot greybox ---------------------------
function makeRobot(colors) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.1, 0.7),
    new THREE.MeshStandardMaterial({ color: colors.main, roughness: 0.6, metalness: 0.35 }),
  );
  body.position.y = 1.0;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.55),
    new THREE.MeshStandardMaterial({ color: colors.dark, roughness: 0.5, metalness: 0.4 }),
  );
  head.position.y = 1.85;
  g.add(head);

  // visière lumineuse (repère de face)
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x9bf6ff, emissive: 0x5fd0e0, emissiveIntensity: 0.9 }),
  );
  visor.position.set(0, 1.9, 0.30);
  g.add(visor);

  const armGeo = new THREE.BoxGeometry(0.30, 0.78, 0.30);
  const armMat = new THREE.MeshStandardMaterial({ color: colors.dark, roughness: 0.5, metalness: 0.4 });
  const gloveGeo = new THREE.BoxGeometry(0.40, 0.40, 0.40);
  const gloveMat = new THREE.MeshStandardMaterial({ color: colors.main, roughness: 0.5, metalness: 0.3 });

  function makeArm(side) {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(armGeo, armMat);
    upper.position.y = -0.1;
    const glove = new THREE.Mesh(gloveGeo, gloveMat);
    glove.position.set(0, -0.5, 0);
    arm.add(upper); arm.add(glove);
    arm.position.set(side * 0.62, 1.25, 0.15);
    g.add(arm);
    arm.userData.rest = arm.position.clone();
    return arm;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  const legGeo = new THREE.BoxGeometry(0.34, 0.7, 0.36);
  const legMat = new THREE.MeshStandardMaterial({ color: colors.dark, roughness: 0.6, metalness: 0.3 });
  for (const sx of [-0.28, 0.28]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(sx, 0.35, 0);
    g.add(leg);
  }

  // ombre plate factice
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);

  return { group: g, body, head, armL, armR, mats: [body.material, head.material] };
}

// ---- état logique d'un combattant --------------------------
function makeFighter(stats, x, z) {
  return {
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    moveSpeed: stats.moveSpeed,
    dodgeCd: stats.dodgeCd,
    damage: stats.damage,
    pos: new THREE.Vector3(x, 0, z),
    facing: 0,
    // timers
    punchT: 999,        // temps écoulé depuis le début du coup
    cooldownT: 0,       // avant de pouvoir refrapper
    hitDone: false,     // ce coup a-t-il déjà touché ?
    lastArm: 1,
    dodgeT: 0,          // temps restant de dash
    dodgeCdT: 0,
    iframeT: 0,
    guard: false,
    flashT: 0,
    dodgeDir: new THREE.Vector3(),
    dead: false,
    // IA
    ai: null,
  };
}

export class Fight {
  constructor({ mount, playerStats, enemyStats, wave, input, onHud, onEnd }) {
    this.mount = mount;
    this.wave = wave;
    this.input = input;
    this.onHud = onHud;
    this.onEnd = onEnd;
    this.running = false;
    this._raf = null;
    this._ending = false;
    this._shake = 0;
    this._sparks = [];

    this._initThree();
    this.player = makeFighter(playerStats, 0, 2.7);
    this.enemy = makeFighter(enemyStats, 0, -2.7);
    this.enemy.ai = { decisionT: 0.4, intent: 'approach', guardHold: 0, strafeSign: 1 };

    this.pMesh = makeRobot({ main: CONFIG.colors.player, dark: CONFIG.colors.playerDark });
    this.eMesh = makeRobot({ main: CONFIG.colors.enemy, dark: CONFIG.colors.enemyDark });
    this.scene.add(this.pMesh.group);
    this.scene.add(this.eMesh.group);

    this._syncMeshes(0);
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  // ---------------------------------------------------------
  _initThree() {
    const w = this.mount.clientWidth || window.innerWidth;
    const h = this.mount.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.Fog(0x0a0e14, 16, 30);

    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 100);
    this.camBase = new THREE.Vector3(0, 15.5, 12.5);
    this.camLook = new THREE.Vector3(0, 0.6, -1.2);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camLook);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.mount.appendChild(this.renderer.domElement);

    // lumières
    this.scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x20160f, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(5, 12, 6);
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0xff88aa, 0.4);
    rim.position.set(-6, 5, -7);
    this.scene.add(rim);

    this._buildRing();
  }

  _buildRing() {
    const R = CONFIG.arena.radius;
    // sol lointain
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(R + 6, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    this.scene.add(floor);

    // plateforme du ring
    const mat = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.6, R + 0.6, 0.3, 40),
      new THREE.MeshStandardMaterial({ color: CONFIG.colors.ringMat, roughness: 0.9 }),
    );
    mat.position.y = -0.15;
    this.scene.add(mat);

    const canvasTop = new THREE.Mesh(
      new THREE.CircleGeometry(R, 40),
      new THREE.MeshStandardMaterial({ color: CONFIG.colors.ring, roughness: 0.85, metalness: 0.1 }),
    );
    canvasTop.rotation.x = -Math.PI / 2;
    canvasTop.position.y = 0.01;
    this.scene.add(canvasTop);

    // cercle central
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x2a3a4f, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    // poteaux + cordes (carré autour du ring)
    const half = R + 0.2;
    const postMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.post, roughness: 0.4, metalness: 0.5 });
    const corners = [
      [half, half], [half, -half], [-half, -half], [-half, half],
    ];
    const postMeshes = [];
    for (const [x, z] of corners) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 12), postMat);
      post.position.set(x, 1.0, z);
      this.scene.add(post);
      postMeshes.push(post);
    }
    // cordes : 3 niveaux
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x8899aa });
    for (const y of [0.7, 1.2, 1.7]) {
      const pts = corners.map(([x, z]) => new THREE.Vector3(x, y, z));
      pts.push(pts[0].clone());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.scene.add(new THREE.Line(geo, ropeMat));
    }
  }

  _resize() {
    const w = this.mount.clientWidth || window.innerWidth;
    const h = this.mount.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------------------------------------------------------
  start() {
    this.running = true;
    this._last = performance.now();
    this._loop();
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const now = performance.now();
    let dt = (now - this._last) / 1000;
    this._last = now;
    dt = Math.min(dt, 0.05); // anti-saut si l'onglet a lagué

    if (this.running) this._update(dt);
    this._syncMeshes(dt);
    this._render(dt);
  }

  // ---------------------------------------------------------
  _update(dt) {
    const p = this.player, e = this.enemy;

    // orientation : chacun regarde l'autre
    p.facing = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    e.facing = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);

    // --- entrées joueur ---
    const inp = this.input;
    let pMove = new THREE.Vector3(inp.move.x, 0, -inp.move.y);
    if (inp.consumeDodge()) this._tryDodge(p, pMove);
    p.guard = inp.guard && p.dodgeT <= 0;
    if (inp.consumePunch()) this._tryPunch(p);

    // --- IA ennemi ---
    const eMove = this._updateAI(e, p, dt);

    // --- déplacement ---
    this._move(p, pMove, dt);
    this._move(e, eMove, dt);
    this._separate(p, e);
    this._clampArena(p);
    this._clampArena(e);

    // --- résolution des coups ---
    this._tickCombat(p, e, dt);
    this._tickCombat(e, p, dt);

    // --- timers d'affichage ---
    p.flashT = Math.max(0, p.flashT - dt);
    e.flashT = Math.max(0, e.flashT - dt);
    this._shake = Math.max(0, this._shake - dt * 3);

    if (this.onHud) this.onHud(Math.max(0, p.hp) / p.maxHp, Math.max(0, e.hp) / e.maxHp);

    // --- KO ? ---
    if (!this._ending && (p.hp <= 0 || e.hp <= 0)) {
      this._ending = true;
      const win = e.hp <= 0;
      sfx.ko();
      this._shake = 1.2;
      (win ? e : p).dead = true;
      setTimeout(() => { this.running = false; if (this.onEnd) this.onEnd({ win }); }, 900);
    }
  }

  _tryPunch(f) {
    if (f.cooldownT > 0 || f.guard || f.dodgeT > 0 || f.dead) return;
    f.punchT = 0;
    f.cooldownT = CONFIG.punch.cooldown;
    f.hitDone = false;
    f.lastArm *= -1;
    sfx.swing();
  }

  _tryDodge(f, dir) {
    if (f.dodgeCdT > 0 || f.dodgeT > 0 || f.dead) return;
    f.dodgeT = CONFIG.dodge.duration;
    f.dodgeCdT = f.dodgeCd;
    f.iframeT = CONFIG.dodge.iframes;
    let d = dir.clone();
    if (d.lengthSq() < 0.01) { d.set(Math.sin(f.facing), 0, Math.cos(f.facing)).multiplyScalar(-1); } // recule
    d.normalize();
    f.dodgeDir.copy(d);
    sfx.dodge();
  }

  _move(f, dir, dt) {
    f.cooldownT = Math.max(0, f.cooldownT - dt);
    f.dodgeCdT = Math.max(0, f.dodgeCdT - dt);
    f.iframeT = Math.max(0, f.iframeT - dt);
    if (f.punchT < 999) f.punchT += dt;
    if (f.dead) return;

    if (f.dodgeT > 0) {
      const speed = CONFIG.dodge.distance / CONFIG.dodge.duration;
      f.pos.addScaledVector(f.dodgeDir, speed * dt);
      f.dodgeT -= dt;
      return;
    }

    let sp = f.moveSpeed;
    if (f.guard) sp *= CONFIG.guard.moveMul;
    if (f.punchT < PUNCH_ANIM) sp *= 0.35; // on ralentit en frappant
    const v = dir.clone();
    if (v.lengthSq() > 1) v.normalize();
    f.pos.addScaledVector(v, sp * dt);
  }

  _separate(a, b) {
    const min = CONFIG.robot.bodyRadius * 2;
    const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.pos.x += nx * push; a.pos.z += nz * push;
      b.pos.x -= nx * push; b.pos.z -= nz * push;
    }
  }

  _clampArena(f) {
    const lim = CONFIG.arena.radius - CONFIG.robot.bodyRadius;
    const d = Math.hypot(f.pos.x, f.pos.z);
    if (d > lim) { f.pos.x = (f.pos.x / d) * lim; f.pos.z = (f.pos.z / d) * lim; }
  }

  // résout le coup de `att` contre `def` s'il entre en fenêtre active
  _tickCombat(att, def, dt) {
    if (att.dead) return;
    const P = CONFIG.punch;
    if (att.punchT >= P.activeFrom && att.punchT <= P.activeTo && !att.hitDone) {
      const dx = def.pos.x - att.pos.x, dz = def.pos.z - att.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= CONFIG.robot.reach) {
        att.hitDone = true;
        if (def.iframeT > 0) return; // esquivé !
        let dmg = att.damage;
        if (def.guard) { dmg *= CONFIG.guard.damageMul; sfx.block(); }
        else { sfx.hit(); }
        def.hp -= dmg;
        def.flashT = 0.16;
        // recul
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        const kb = def.guard ? P.knockback * 0.3 : P.knockback;
        def.pos.x += nx * kb * 0.12; def.pos.z += nz * kb * 0.12;
        this._shake = Math.max(this._shake, def.guard ? 0.25 : 0.6);
        this._spawnSpark(att.pos, def.pos);
      }
    }
  }

  // ---- IA : machine à états simple ----
  _updateAI(e, p, dt) {
    const w = this.wave;
    const ai = e.ai;
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    const inRange = dist <= CONFIG.robot.reach * 0.95;

    ai.guardHold = Math.max(0, ai.guardHold - dt);
    e.guard = ai.guardHold > 0 && e.dodgeT <= 0;

    ai.decisionT -= dt;
    if (ai.decisionT <= 0) {
      ai.decisionT = CONFIG.enemy.reaction(w) * (0.7 + Math.random() * 0.6);
      if (!inRange) {
        ai.intent = 'approach';
      } else {
        const r = Math.random();
        if (r < CONFIG.enemy.aggression(w)) {
          this._tryPunch(e);
          ai.intent = 'hold';
        } else if (r < CONFIG.enemy.aggression(w) + CONFIG.enemy.guardChance(w)) {
          ai.guardHold = 0.35 + Math.random() * 0.3;
          ai.intent = 'hold';
        } else {
          ai.intent = 'backoff';
          ai.strafeSign = Math.random() < 0.5 ? 1 : -1;
        }
      }
      // réaction : esquiver si le joueur frappe de près
      if (inRange && p.punchT < CONFIG.punch.activeTo && Math.random() < 0.35 + w * 0.03) {
        this._tryDodge(e, new THREE.Vector3(-dx, 0, -dz));
      }
    }

    // exécution de l'intention -> vecteur de déplacement
    const dir = new THREE.Vector3();
    const nx = dx / (dist || 1), nz = dz / (dist || 1);
    if (ai.intent === 'approach') dir.set(nx, 0, nz);
    else if (ai.intent === 'backoff') dir.set(-nx + ai.strafeSign * nz * 0.6, 0, -nz - ai.strafeSign * nx * 0.6);
    // 'hold' -> immobile
    e.moveSpeed = CONFIG.enemy.move(w);
    return dir;
  }

  // ---------------------------------------------------------
  _spawnSpark(from, to) {
    const pos = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    pos.y = 1.2;
    const s = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 1 }),
    );
    s.position.copy(pos);
    this.scene.add(s);
    this._sparks.push({ mesh: s, t: 0 });
  }

  _syncMeshes(dt) {
    this._applyRobot(this.pMesh, this.player);
    this._applyRobot(this.eMesh, this.enemy);
    // sparks
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const sp = this._sparks[i];
      sp.t += dt;
      const k = sp.t / 0.2;
      sp.mesh.scale.setScalar(1 + k * 2);
      sp.mesh.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.scene.remove(sp.mesh); this._sparks.splice(i, 1); }
    }
  }

  _applyRobot(mesh, f) {
    mesh.group.position.set(f.pos.x, 0, f.pos.z);
    mesh.group.rotation.y = f.facing;

    // KO : le robot tombe
    if (f.dead) {
      mesh.group.rotation.x = Math.min(Math.PI / 2, mesh.group.rotation.x + 0.08);
      mesh.group.position.y = 0;
    } else {
      mesh.group.rotation.x = 0;
    }

    // animation des bras (coup de poing)
    const rL = mesh.armL.userData.rest, rR = mesh.armR.userData.rest;
    mesh.armL.position.copy(rL);
    mesh.armR.position.copy(rR);
    if (f.punchT < PUNCH_ANIM) {
      const k = Math.sin(Math.PI * (f.punchT / PUNCH_ANIM)); // 0->1->0
      const arm = f.lastArm > 0 ? mesh.armR : mesh.armL;
      arm.position.z += k * 0.75;
      arm.position.y += k * 0.15;
    }
    // garde : bras relevés devant
    if (f.guard) {
      mesh.armL.position.z += 0.25; mesh.armL.position.y += 0.2;
      mesh.armR.position.z += 0.25; mesh.armR.position.y += 0.2;
    }

    // flash blanc quand touché
    const flash = f.flashT > 0 ? 1 : 0;
    for (const m of mesh.mats) {
      m.emissive = m.emissive || new THREE.Color();
      m.emissive.setRGB(flash, flash, flash).multiplyScalar(0.8);
    }
  }

  _render() {
    // secousse caméra
    const s = this._shake;
    this.camera.position.set(
      this.camBase.x + (Math.random() - 0.5) * s,
      this.camBase.y + (Math.random() - 0.5) * s * 0.5,
      this.camBase.z + (Math.random() - 0.5) * s,
    );
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------
  dispose() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
