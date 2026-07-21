// =============================================================
//  IRON RING — entrées (tactile + clavier)
//  Joystick gauche dynamique (apparaît sous le pouce) + boutons.
//  move.x : -1 gauche .. +1 droite
//  move.y : -1 vers la caméra .. +1 loin de la caméra (déjà inversé)
// =============================================================

const JOY_RADIUS = 56; // px : rayon max du joystick

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.guard = false;
    this._punch = false;
    this._dodge = false;
    this.keys = {};

    this._joyId = null;
    this._joyOrigin = { x: 0, y: 0 };

    this._joyZone = document.getElementById('joy-zone');
    this._joyBase = document.getElementById('joy-base');
    this._joyKnob = document.getElementById('joy-knob');

    this._bindTouch();
    this._bindButtons();
    this._bindKeyboard();
  }

  // --- édge-triggers (consommés une fois) ---
  consumePunch() { const v = this._punch; this._punch = false; return v; }
  consumeDodge() { const v = this._dodge; this._dodge = false; return v; }
  queuePunch() { this._punch = true; }
  queueDodge() { this._dodge = true; }

  reset() {
    this.move.x = 0; this.move.y = 0;
    this.guard = false;
    this._punch = false; this._dodge = false;
    this._joyId = null;
    if (this._joyBase) this._joyBase.style.display = 'none';
  }

  // ---------------------------------------------------------
  _bindTouch() {
    const zone = this._joyZone;
    if (!zone) return;

    zone.addEventListener('pointerdown', (e) => {
      if (this._joyId !== null) return;
      this._joyId = e.pointerId;
      this._joyOrigin = { x: e.clientX, y: e.clientY };
      if (this._joyBase) {
        this._joyBase.style.display = 'block';
        this._joyBase.style.left = e.clientX + 'px';
        this._joyBase.style.top = e.clientY + 'px';
      }
      this._setKnob(0, 0);
      zone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._joyId) return;
      let dx = e.clientX - this._joyOrigin.x;
      let dy = e.clientY - this._joyOrigin.y;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, JOY_RADIUS);
      if (len > 0) { dx = (dx / len) * clamped; dy = (dy / len) * clamped; }
      this.move.x = dx / JOY_RADIUS;
      this.move.y = -dy / JOY_RADIUS; // écran: bas = +, on inverse pour "avant = +"
      this._setKnob(dx, dy);
      e.preventDefault();
    });

    const end = (e) => {
      if (e.pointerId !== this._joyId) return;
      this._joyId = null;
      this.move.x = 0; this.move.y = 0;
      if (this._joyBase) this._joyBase.style.display = 'none';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  _setKnob(dx, dy) {
    if (this._joyKnob) {
      this._joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  // ---------------------------------------------------------
  _bindButtons() {
    const punch = document.getElementById('btn-punch');
    const dodge = document.getElementById('btn-dodge');
    const guard = document.getElementById('btn-guard');

    const press = (el, on) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); on(true); el.classList.add('active'); });
      const off = (e) => { e.preventDefault(); on(false); el.classList.remove('active'); };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };

    // Punch / Dodge : édge (au press)
    if (punch) punch.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.queuePunch(); punch.classList.add('active'); });
    if (punch) ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => punch.addEventListener(ev, () => punch.classList.remove('active')));
    if (dodge) dodge.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.queueDodge(); dodge.classList.add('active'); });
    if (dodge) ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => dodge.addEventListener(ev, () => dodge.classList.remove('active')));

    // Guard : maintenu
    press(guard, (on) => { this.guard = on; });
  }

  // ---------------------------------------------------------
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { this._applyKeys(); return; }
      this.keys[e.code] = true;
      if (e.code === 'KeyJ' || e.code === 'Enter') this.queuePunch();
      if (e.code === 'Space') { this.queueDodge(); e.preventDefault(); }
      this._applyKeys();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this._applyKeys();
    });
  }

  _applyKeys() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k['KeyA'] || k['ArrowLeft']) x -= 1;
    if (k['KeyD'] || k['ArrowRight']) x += 1;
    if (k['KeyW'] || k['ArrowUp']) y += 1;
    if (k['KeyS'] || k['ArrowDown']) y -= 1;
    // le clavier ne pilote le déplacement que si aucun joystick tactile actif
    if (this._joyId === null) {
      const len = Math.hypot(x, y) || 1;
      this.move.x = x / len;
      this.move.y = y / len;
    }
    this.guard = !!(k['KeyK'] || k['ShiftLeft'] || k['ShiftRight']);
  }
}
