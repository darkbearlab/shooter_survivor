// WeaponViewModel — Doom/Duke-style centered bottom weapon sprite.
// Canvas: 640×360, weapon drawn large at bottom-center.
// Animations: idle bob, fire kick, reload raise, switch slide.

export class WeaponViewModel {
  constructor() {
    this._canvas = document.getElementById('viewmodel-canvas');
    this._ctx    = this._canvas.getContext('2d');

    const W = this._canvas.width;   // 640
    const H = this._canvas.height;  // 360

    // Current & pending weapon
    this._weaponId  = 'shotgun';
    this._pendingId = null;

    // Animation position (offsets from rest position at canvas bottom-center)
    this._y      = H + 60;   // start off-screen below
    this._x      = 0;
    this._tilt   = 0;        // radians, positive = clockwise
    this._kickY  = 0;
    this._kickX  = 0;

    // Spring targets
    this._yTarget    = 0;
    this._xTarget    = 0;
    this._tiltTarget = 0;

    // Velocities for spring simulation
    this._yVel    = 0;
    this._xVel    = 0;
    this._tiltVel = 0;
    this._kickYVel = 0;
    this._kickXVel = 0;

    // Bob
    this._bobPhase = 0;

    // Muzzle flash
    this._muzzleTimer = 0;

    // State machine
    this._state = 'slidein';
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  onFire() {
    this._kickY = -22;
    this._kickX = (Math.random() - 0.5) * 10;
    this._muzzleTimer = 0.075;
  }

  onReloadStart() {
    if (this._state === 'slideout') return;
    this._state      = 'reload';
    this._tiltTarget = -0.35;   // tilt barrel up (negative = counter-clockwise)
    this._yTarget    = -30;
  }

  onReloadEnd() {
    if (this._state !== 'reload') return;
    this._state      = 'idle';
    this._tiltTarget = 0;
    this._yTarget    = 0;
  }

  onSwitchOut(newId) {
    this._pendingId  = newId;
    this._state      = 'slideout';
    this._yTarget    = this._canvas.height + 80;
    this._tiltTarget = 0;
    this._xTarget    = 0;
  }

  setWeapon(id) {
    if (this._state === 'slideout') {
      this._pendingId = id;
    } else {
      this._weaponId = id;
      this._slideIn();
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt) {
    const H = this._canvas.height;
    this._bobPhase += dt * 2.2;
    if (this._muzzleTimer > 0) this._muzzleTimer -= dt;

    // Bob only in idle
    const bob  = this._state === 'idle' ? Math.sin(this._bobPhase) * 5   : 0;
    const bobX = this._state === 'idle' ? Math.sin(this._bobPhase * 0.5) * 3 : 0;

    // Kick springs (very snappy)
    this._kickY = _damp(this._kickY, 0, dt, 28, 0.07);
    this._kickX = _damp(this._kickX, 0, dt, 26, 0.07);

    // Position springs (smooth)
    this._y    = _damp(this._y,    this._yTarget,    dt, 14, 0.22);
    this._x    = _damp(this._x,    this._xTarget,    dt, 14, 0.22);
    this._tilt = _damp(this._tilt, this._tiltTarget, dt, 12, 0.25);

    // Detect slide-out completion
    if (this._state === 'slideout' && this._y > H + 60) {
      this._weaponId  = this._pendingId ?? this._weaponId;
      this._pendingId = null;
      // Reset position to come in from bottom
      this._y = H + 80;
      this._slideIn();
    }

    this._draw(bob, bobX);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _slideIn() {
    this._state      = 'slidein';
    this._yTarget    = 0;
    this._tiltTarget = 0;
    this._xTarget    = 0;
    setTimeout(() => { if (this._state === 'slidein') this._state = 'idle'; }, 550);
  }

  _draw(bob, bobX) {
    const cv  = this._canvas;
    const ctx = this._ctx;
    const W = cv.width, H = cv.height;

    ctx.clearRect(0, 0, W, H);

    const totalY = this._y + this._kickY + bob;
    const totalX = this._x + this._kickX + bobX;

    ctx.save();
    ctx.translate(W / 2 + totalX, H + totalY);
    ctx.rotate(this._tilt);
    ctx.translate(-W / 2, -H);

    const draw = WEAPON_DRAW[this._weaponId];
    if (draw) draw(ctx, W, H);

    ctx.restore();

    // Muzzle flash drawn outside transform so it stays at screen position
    if (this._muzzleTimer > 0) {
      const mp = MUZZLE_POS[this._weaponId];
      if (mp) {
        const mx = mp.x(W);
        const my = mp.y(H) + totalY;
        _drawMuzzleFlash(ctx, mx, my, this._muzzleTimer / 0.075);
      }
    }
  }
}

// ── Spring damper ─────────────────────────────────────────────────────────────

function _damp(cur, target, dt, stiffness, damping) {
  return cur + (target - cur) * Math.min(1, stiffness * dt * (1 - damping));
}

// ── Muzzle flash ──────────────────────────────────────────────────────────────

function _drawMuzzleFlash(ctx, x, y, t) {
  ctx.save();
  const r = 30 * t;
  // Outer glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
  grd.addColorStop(0,   `rgba(255,220,80,${t * 0.9})`);
  grd.addColorStop(0.4, `rgba(255,140,20,${t * 0.6})`);
  grd.addColorStop(1,   `rgba(255,60,0,0)`);
  ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = grd; ctx.fill();
  // White core
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,230,${t})`; ctx.fill();
  // Spikes
  ctx.strokeStyle = `rgba(255,200,60,${t * 0.85})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const len = r * (1.5 + Math.random() * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
    ctx.lineTo(x + Math.cos(a) * len,     y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function r(ctx, x, y, w, h, fill, stroke, lw = 2) {
  ctx.fillStyle   = fill;
  ctx.strokeStyle = stroke ?? fill;
  ctx.lineWidth   = lw;
  ctx.fillRect(x, y, w, h);
  if (stroke) ctx.strokeRect(x, y, w, h);
}

// Trapezoid (perspective taper): top narrower than bottom
function trap(ctx, x, y, wTop, wBot, h, fill, stroke) {
  const xOff = (wBot - wTop) / 2;
  ctx.beginPath();
  ctx.moveTo(x + xOff,        y);
  ctx.lineTo(x + xOff + wTop, y);
  ctx.lineTo(x + wBot,        y + h);
  ctx.lineTo(x,                y + h);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// ── Weapon draw functions ─────────────────────────────────────────────────────
// Each receives (ctx, W, H). Weapons are drawn anchored near (W/2, H).
// Doom-style: barrel points slightly left of center, hands at bottom.

const WEAPON_DRAW = {

  shotgun(ctx, W, H) {
    const cx = W / 2 - 40, cy = H;

    // Right hand / grip
    trap(ctx, cx + 100, cy - 120, 55, 70, 120, '#c8a46e', '#8a6030');
    r(ctx, cx + 108, cy - 128, 42, 20, '#b8904e', '#7a5020');   // thumb

    // Left hand / forestock
    trap(ctx, cx - 30, cy - 95, 70, 85, 95, '#c8a46e', '#8a6030');

    // Stock (wood, behind right hand)
    r(ctx, cx + 130, cy - 160, 60,  90, '#7a4010', '#4a2008', 2);
    r(ctx, cx + 148, cy - 180, 30,  25, '#8a5018', '#4a2008', 2);  // butt curve

    // Receiver body
    r(ctx, cx + 20,  cy - 200, 120, 85, '#2a2820', '#1a1810', 2);

    // Pump / forestock wood
    r(ctx, cx - 40, cy - 165, 80,  28, '#7a4010', '#4a2008', 2);
    r(ctx, cx - 40, cy - 155, 80,  10, '#9a5818', null);          // pump highlight

    // Barrel (long, main feature)
    r(ctx, cx - 160, cy - 185, 195, 22, '#1a1a18', '#111110', 2);
    r(ctx, cx - 160, cy - 178, 195,  8, '#2a2a28', null);          // top shine
    // Barrel band
    r(ctx, cx - 80,  cy - 190, 12,  32, '#888880', '#555550', 2);
    r(ctx, cx - 20,  cy - 190, 10,  32, '#888880', '#555550', 2);
    // Muzzle
    r(ctx, cx - 175, cy - 196, 22,  36, '#111110', '#080808', 2);

    // Ejection port
    r(ctx, cx + 55,  cy - 188, 30,  18, '#111110', null);

    // Guard
    r(ctx, cx + 95,  cy - 135, 30,  40, '#1e1c14', '#0e0c0a', 2);

    // Shell tube under barrel
    r(ctx, cx - 155, cy - 162, 175, 12, '#222220', '#111110');
  },

  rocket(ctx, W, H) {
    const cx = W / 2 - 20, cy = H;

    // Right hand
    trap(ctx, cx + 80, cy - 115, 60, 75, 115, '#c8a46e', '#8a6030');
    r(ctx, cx + 88,  cy - 125, 45, 18, '#b8904e', '#7a5020');

    // Left hand (bracing tube)
    trap(ctx, cx - 60, cy - 90, 75, 90, 90, '#c8a46e', '#8a6030');

    // Main launch tube
    r(ctx, cx - 180, cy - 215, 280, 65, '#555560', '#333340', 3);
    r(ctx, cx - 180, cy - 210, 280, 20, '#6a6a78', null);          // top highlight
    r(ctx, cx - 180, cy - 195, 280,  5, '#3a3a44', null);          // shadow line

    // Muzzle bell (open end, wider)
    r(ctx, cx - 195, cy - 225, 28,  85, '#333338', '#222228', 2);
    r(ctx, cx - 208, cy - 232, 22, 100, '#222226', '#181820', 2);

    // Rear blast shield / shoulder rest
    r(ctx, cx + 80,  cy - 230, 30, 115, '#4a4a55', '#2a2a33', 2);
    r(ctx, cx + 106, cy - 210, 50,  75, '#3a3a44', '#222230', 2);

    // Sight on top
    r(ctx, cx + 10, cy - 222, 50, 12, '#336633', '#224422', 2);
    r(ctx, cx + 20, cy - 228,  6,  6, '#88cc88', null);

    // Grip
    r(ctx, cx + 80,  cy - 115, 24, 40, '#222228', '#14141e', 2);

    // Warning stripe
    r(ctx, cx + 40, cy - 215, 14, 65, '#ff8800', null);
    r(ctx, cx - 60, cy - 215, 14, 65, '#ff8800', null);

    // Rocket visible in tube (back end)
    r(ctx, cx + 60, cy - 208, 18, 51, '#cc5500', '#882200', 2);
    r(ctx, cx + 65, cy - 200, 8,  35, '#ff7700', null);
  },

  machinegun(ctx, W, H) {
    const cx = W / 2 - 50, cy = H;

    // Right hand
    trap(ctx, cx + 110, cy - 120, 55, 70, 120, '#c8a46e', '#8a6030');
    r(ctx, cx + 118, cy - 130, 40, 18, '#b8904e', '#7a5020');

    // Left hand on foregrip
    trap(ctx, cx, cy - 100, 65, 80, 100, '#c8a46e', '#8a6030');

    // Stock
    r(ctx, cx + 155, cy - 175, 55,  80, '#1e1e18', '#0e0e0c', 2);
    r(ctx, cx + 170, cy - 190, 28,  20, '#252520', '#101010', 2);

    // Receiver body
    r(ctx, cx + 20,  cy - 210, 145, 95, '#1e1e1c', '#101010', 2);

    // Top rail / carry handle
    r(ctx, cx + 30,  cy - 220, 120, 14, '#2a2a28', '#1a1a16', 2);
    r(ctx, cx + 50,  cy - 215,  80,  5, '#3a3a38', null);

    // Long barrel
    r(ctx, cx - 200, cy - 202, 235, 18, '#171716', '#0a0a09', 2);
    r(ctx, cx - 200, cy - 196, 235,  6, '#272726', null);

    // Barrel shroud / heat shield
    r(ctx, cx - 160, cy - 208, 140, 28, '#222220', '#151513', 2);
    // Vent slots
    for (let i = 0; i < 6; i++) {
      r(ctx, cx - 148 + i * 20, cy - 202, 10, 16, '#111110', null);
    }

    // Drum magazine (large circle)
    ctx.fillStyle = '#1e1e1c'; ctx.strokeStyle = '#0e0e0c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx + 75, cy - 115, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Drum detail rings
    ctx.strokeStyle = '#2a2a28'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx + 75, cy - 115, 35, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 75, cy - 115, 18, 0, Math.PI * 2); ctx.stroke();
    r(ctx, cx + 67, cy - 125, 16, 8, '#333330', null);   // latch

    // Grip
    r(ctx, cx + 128, cy - 125, 22, 50, '#151514', '#0a0a08', 2);

    // Muzzle device
    r(ctx, cx - 216, cy - 208, 20, 28, '#111110', '#080808', 2);

    // Selector / detail
    r(ctx, cx + 148, cy - 178, 10, 22, '#333330', null);
  },

  nailgun(ctx, W, H) {
    const cx = W / 2 - 30, cy = H;

    // Right hand
    trap(ctx, cx + 90, cy - 115, 55, 68, 115, '#c8a46e', '#8a6030');
    r(ctx, cx + 98,  cy - 125, 40, 18, '#b8904e', '#7a5020');

    // Left hand
    trap(ctx, cx - 20, cy - 95, 65, 78, 95, '#c8a46e', '#8a6030');

    // Stock/body — compact military green
    r(ctx, cx + 100, cy - 180, 55, 80, '#334433', '#1e2e1e', 2);

    // Main body
    r(ctx, cx - 10, cy - 200, 120, 90, '#3a4e3a', '#222e22', 2);

    // Top: nail feed tube
    r(ctx, cx + 20,  cy - 215, 70, 18, '#2a3a2a', '#1a2a1a', 2);
    r(ctx, cx + 28,  cy - 210, 54,  6, '#4a6a4a', null);       // highlight

    // Twin barrels — main feature
    r(ctx, cx - 160, cy - 196, 175, 16, '#1a221a', '#0e160e', 2);
    r(ctx, cx - 160, cy - 175, 175, 16, '#1a221a', '#0e160e', 2);
    // Barrel highlight
    r(ctx, cx - 160, cy - 190, 175,  5, '#2a322a', null);
    r(ctx, cx - 160, cy - 169, 175,  5, '#2a322a', null);
    // Barrel bands
    for (let i = 0; i < 3; i++) {
      r(ctx, cx - 100 + i * 50, cy - 200, 8, 44, '#556655', '#334433', 1.5);
    }
    // Muzzle tips
    r(ctx, cx - 175, cy - 200, 18, 22, '#111811', '#080e08', 2);
    r(ctx, cx - 175, cy - 172, 18, 22, '#111811', '#080e08', 2);

    // Grip
    r(ctx, cx + 108, cy - 115, 20, 48, '#1e2e1e', '#0e180e', 2);

    // Accent stripe
    r(ctx, cx - 8,  cy - 200, 4, 90, '#44aa44', null);
    r(ctx, cx + 40, cy - 200, 4, 90, '#44aa44', null);

    // Guard
    r(ctx, cx + 80, cy - 130, 28, 38, '#2a3a2a', '#1a2a1a', 2);
  },

  railgun(ctx, W, H) {
    const cx = W / 2 - 60, cy = H;

    // Right hand
    trap(ctx, cx + 130, cy - 120, 55, 68, 120, '#c8a46e', '#8a6030');
    r(ctx, cx + 138, cy - 130, 40, 18, '#b8904e', '#7a5020');

    // Left hand steadying barrel
    trap(ctx, cx - 10, cy - 100, 70, 85, 100, '#c8a46e', '#8a6030');

    // Stock / rear section
    r(ctx, cx + 148, cy - 195, 55,  95, '#1a2233', '#0e1422', 2);
    r(ctx, cx + 168, cy - 210, 24,  20, '#1e2a3e', '#0e1422', 2);

    // Main body
    r(ctx, cx + 20,  cy - 215, 138, 100, '#1e2a3a', '#0e1828', 2);

    // Energy cell / capacitor (side-mounted)
    r(ctx, cx + 30,  cy - 230,  80,  18, '#0a3344', '#00aacc', 2);
    // Cell glow
    ctx.fillStyle = '#00ccff44';
    ctx.fillRect(cx + 32, cy - 229, 76, 14);
    // Cell segments
    for (let i = 0; i < 5; i++) {
      const glow = i % 2 === 0 ? '#00eeff' : '#006688';
      r(ctx, cx + 34 + i * 14, cy - 228, 10, 12, glow, null);
    }

    // Very long barrel — the main visual feature
    r(ctx, cx - 240, cy - 210, 275, 22, '#151e2a', '#0a1018', 2);
    r(ctx, cx - 240, cy - 195, 275, 22, '#151e2a', '#0a1018', 2);
    // Rails (cyan glow)
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = '#00aaff';
    ctx.strokeStyle = '#00ddff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 238, cy - 204); ctx.lineTo(cx + 32, cy - 204); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 238, cy - 192); ctx.lineTo(cx + 32, cy - 192); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Barrel shroud sections
    for (let i = 0; i < 5; i++) {
      r(ctx, cx - 210 + i * 46, cy - 215, 10, 52, '#222e3e', '#1218248', 2);
    }

    // Muzzle
    r(ctx, cx - 258, cy - 218, 22, 68, '#111820', '#080e16', 2);
    // Muzzle glow ring
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = '#00aaff';
    ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - 257, cy - 217, 20, 66);
    ctx.restore();

    // Sight
    r(ctx, cx + 60, cy - 224, 55, 12, '#1a2a3a', '#0e1828', 2);
    r(ctx, cx + 72, cy - 228,  8,  4, '#00ccff', null);

    // Grip
    r(ctx, cx + 140, cy - 122, 22, 52, '#111820', '#080e16', 2);
  },

  fists(ctx, W, H) {
    const cy = H;

    // Left fist (punching forward, more centered-left)
    _drawFist(ctx, W / 2 - 130, cy, false);
    // Right fist (slightly back, right side)
    _drawFist(ctx, W / 2 + 20,  cy, true);
  },
};

function _drawFist(ctx, cx, cy, isRight) {
  const flip = isRight ? 1 : -1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(flip, 1);   // mirror for right hand

  // Forearm
  trap(ctx, -30, -220, 60, 80, 140, '#c8a46e', '#8a6030');
  // Sleeve
  r(ctx, -34, -225, 68, 35, '#4a3010', '#2a1808', 2);

  // Back of hand
  r(ctx, -38, -280, 76, 65, '#c8a46e', '#8a6030', 2);
  // Knuckle ridge
  r(ctx, -34, -282, 68, 10, '#e0b880', null);

  // Fingers (four blocks, perspective foreshortened)
  for (let i = 0; i < 4; i++) {
    const fx = -34 + i * 17;
    r(ctx, fx, -310, 13, 32, '#c8a46e', '#8a6030', 1.5);
    // Knuckle dot
    ctx.fillStyle = '#ddbb88';
    ctx.beginPath(); ctx.arc(fx + 6, -284, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Thumb (side)
  r(ctx, 34, -272, 14, 28, '#c8a46e', '#8a6030', 1.5);

  // Wrap tape / glove trim
  r(ctx, -38, -222, 76,  8, '#ccbb88', '#aa9966', 1.5);
  r(ctx, -38, -210, 76,  6, '#ccbb88', '#aa9966', 1);

  ctx.restore();
}

// ── Muzzle positions (canvas px, relative to W/2) ────────────────────────────
// These are where the muzzle flash appears, in the translated+rotated space.
// x is relative to W/2 (center of canvas), y is absolute.

const MUZZLE_POS = {
  shotgun:    { x: W => W / 2 - 215, y: H => H - 178 },
  rocket:     { x: W => W / 2 - 240, y: H => H - 183 },
  machinegun: { x: W => W / 2 - 270, y: H => H - 195 },
  nailgun:    { x: W => W / 2 - 210, y: H => H - 178 },
  railgun:    { x: W => W / 2 - 315, y: H => H - 202 },
  fists:      { x: W => W / 2 - 80,  y: H => H - 295 },
};

