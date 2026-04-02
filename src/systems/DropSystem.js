// DropSystem — world pickups (health, armor, ammo, weapons)
//
// spawn(pos, cfg)  — drop a pickup at world position
//   cfg.type:      'health' | 'armor' | 'ammo' | 'weapon'
//   cfg.amount:    number                  (health/armor/ammo)
//   cfg.weaponId:  string                  (ammo: which weapon; weapon: which weapon def)
//   cfg.life:      number (default 60)     seconds until auto-remove
//
// update(dt, playerPos) → array of auto-consumed pickups { type, amount, weaponId }
//   NOTE: 'weapon' type drops are NOT returned here — use nearbyWeaponDrop() + consumeAt()
//
// nearbyWeaponDrop(pos, radius) → { index, cfg } | null
// consumeAt(index) → cfg

import * as THREE from 'three';

const AUTO_PICKUP_RADIUS = 1.2;
const WEAPON_INTERACT_RADIUS = 1.8;
const DEFAULT_LIFE   = 60;
const BOB_SPEED      = 2.5;
const BOB_AMP        = 0.14;

// ── Weapon visual helpers ────────────────────────────────────────────────────

const WEAPON_SHORT = {
  fists: 'FT', shotgun: 'SG', rocket: 'RL',
  railgun: 'RG', machinegun: 'MG', nailgun: 'NG',
};
const WEAPON_COLOR = {
  fists: '#ffaaaa', shotgun: '#ffdd44', rocket: '#ff8822',
  railgun: '#44ffee', machinegun: '#88ff44', nailgun: '#aaddff',
};

// ── Canvas textures ───────────────────────────────────────────────────────────

function makeDropTex(type, weaponId) {
  const S = 32, H = S / 2;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');

  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath();
  ctx.arc(H, H, H - 1, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'health') {
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(H - 3, H - 10, 6, 20);
    ctx.fillRect(H - 10, H - 3, 20, 6);

  } else if (type === 'armor') {
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(H,     H - 10); ctx.lineTo(H + 9, H - 5);
    ctx.lineTo(H + 9, H + 3);  ctx.lineTo(H,     H + 11);
    ctx.lineTo(H - 9, H + 3);  ctx.lineTo(H - 9, H - 5);
    ctx.closePath();
    ctx.stroke();

  } else if (type === 'ammo') {
    const col = WEAPON_COLOR[weaponId] ?? '#ffff88';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(H, H - 4, 5, Math.PI, 0);
    ctx.rect(H - 5, H - 4, 10, 13);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(H - 5, H + 5, 10, 2);

  } else if (type === 'weapon') {
    const col   = WEAPON_COLOR[weaponId] ?? '#88ff44';
    const label = WEAPON_SHORT[weaponId] ?? 'W?';
    ctx.fillStyle = col;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, H, H + 1);
  }

  // Glow ring
  const ringCol = { health: '#ff7777', armor: '#77bbff', ammo: '#ffee88', weapon: '#ffffff' };
  ctx.strokeStyle = type === 'weapon'
    ? (WEAPON_COLOR[weaponId] ?? '#88ff44')
    : (ringCol[type] ?? '#ffffff');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(H, H, H - 2, 0, Math.PI * 2);
  ctx.stroke();

  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

const _texCache = {};
function getDropTex(type, weaponId) {
  const key = weaponId ? `${type}_${weaponId}` : type;
  if (!_texCache[key]) _texCache[key] = makeDropTex(type, weaponId);
  return _texCache[key];
}

// ── DropSystem ────────────────────────────────────────────────────────────────

export class DropSystem {
  constructor(scene) {
    this.scene = scene;
    this.drops = [];
    this._time = 0;
  }

  spawn(pos, cfg) {
    const tex = getDropTex(cfg.type, cfg.weaponId);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.7, 0.7, 1);
    sprite.position.set(pos.x, pos.y + 0.55, pos.z);
    this.scene.add(sprite);

    this.drops.push({
      sprite,
      baseY:  pos.y + 0.55,
      phase:  Math.random() * Math.PI * 2,
      cfg:    { ...cfg },
      life:   cfg.life ?? DEFAULT_LIFE,
    });
  }

  /**
   * Tick all drops. Returns array of auto-consumed pickup events (non-weapon only).
   */
  update(dt, playerPos) {
    this._time += dt;
    const pickups = [];

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];

      // Countdown
      d.life -= dt;

      // Flash when about to expire (last 5s)
      if (d.life < 5) {
        const flash = Math.sin(d.life * 12) > 0;
        d.sprite.material.opacity = flash ? 1.0 : 0.35;
      } else {
        d.sprite.material.opacity = 1.0;
      }

      if (d.life <= 0) {
        this._removeDrop(i);
        continue;
      }

      // Bob animation
      d.sprite.position.y = d.baseY + Math.sin(this._time * BOB_SPEED + d.phase) * BOB_AMP;

      // Weapon drops require E key — skip auto-pickup
      if (d.cfg.type === 'weapon') continue;

      // Auto-pickup proximity (XZ only)
      const dx = playerPos.x - d.sprite.position.x;
      const dz = playerPos.z - d.sprite.position.z;
      if (dx * dx + dz * dz < AUTO_PICKUP_RADIUS * AUTO_PICKUP_RADIUS) {
        pickups.push({ ...d.cfg });
        this._removeDrop(i);
      }
    }

    return pickups;
  }

  /**
   * Returns the nearest weapon drop within interact range, or null.
   */
  nearbyWeaponDrop(playerPos) {
    let best = null;
    let bestDist = WEAPON_INTERACT_RADIUS * WEAPON_INTERACT_RADIUS;

    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (d.cfg.type !== 'weapon') continue;
      const dx = playerPos.x - d.sprite.position.x;
      const dz = playerPos.z - d.sprite.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDist) { bestDist = d2; best = { index: i, cfg: d.cfg }; }
    }

    return best;
  }

  /** Remove a weapon drop by index and return its cfg. */
  consumeAt(index) {
    const d = this.drops[index];
    if (!d) return null;
    const cfg = { ...d.cfg };
    this._removeDrop(index);
    return cfg;
  }

  _removeDrop(i) {
    const d = this.drops[i];
    this.scene.remove(d.sprite);
    d.sprite.material.dispose();
    this.drops.splice(i, 1);
  }

  dispose() {
    for (let i = this.drops.length - 1; i >= 0; i--) this._removeDrop(i);
    this._time = 0;
  }
}
