import * as THREE from 'three';
import { WeaponState } from './weapons.js';

// ── Quake-style movement constants ────────────────────────────────────────────
const MOVE_SPEED      = 12;
const GROUND_ACCEL    = 10;
const GROUND_FRICTION = 8;
const AIR_ACCEL       = 2.5;
const AIR_MAX_SPEED   = 8;
const JUMP_FORCE      = 8;
const GRAVITY         = 22;
const PLAYER_RADIUS   = 0.4;
const PLAYER_HEIGHT   = 1.8;  // capsule height from feet
const EYE_OFFSET      = 1.65; // camera height above feet

export class Player {
  constructor(character, camera, collisionSystem) {
    this.character = character;
    this.camera    = camera;
    this.collision = collisionSystem;

    const s = character.baseStats;
    this.maxHp    = s.maxHp;
    this.hp       = s.maxHp;
    this.maxArmor = s.maxArmor;
    // Quake-style loadout: startArmor = 0. Classic chars start full.
    this.armor    = character.startArmor ?? s.maxArmor;
    this.speedMult          = s.moveSpeed;
    this.damageMultiplier   = s.damageMultiplier;
    this.reloadMultiplier   = s.reloadMultiplier;

    // HP regen (loadout passive: positive = heal, negative = drain)
    this._hpRegenRate  = s.hpRegen ?? 0;
    this._hpRegenTimer = 5;

    // Feet position in world space
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw      = 0;
    this.pitch    = 0;
    this.onGround = false;

    // Weapons: driven by character.startingWeapons array (hard cap: MAX_WEAPON_SLOTS)
    this.MAX_WEAPON_SLOTS = 3;
    const weaponIds  = (character.startingWeapons ?? [character.startingWeapon ?? 'shotgun'])
                         .slice(0, this.MAX_WEAPON_SLOTS);
    this.weapons     = weaponIds.map(id => new WeaponState(id));

    // Loadout reserve multiplier — scale all weapon reserves at creation
    const reserveMult = s.reserveMult ?? 1.0;
    if (reserveMult !== 1.0) {
      for (const w of this.weapons) {
        if (w.def.type === 'melee') continue;
        w.reserve = Math.max(1, Math.round(w.reserve * reserveMult));
        w.def = { ...w.def, reserveAmmo: Math.max(1, Math.round(w.def.reserveAmmo * reserveMult)) };
      }
    }
    this.weaponSlot  = 0;
    this.isFiring    = false;

    // Active skill
    this._skillCooldown    = 0;
    this._skillMaxCooldown = character.activeSkill?.cooldown ?? 0;
    this._wantsSkill       = false;
    this._wantsInteract    = false;

    // Passive: combat instinct (ranger)
    this.killStreak    = 0;
    this.nextShotDouble = false;

    // Upgrades
    this.upgradeLevel = 0;
    this.passives     = []; // ids of acquired unique passives
    this.upgrades     = {
      damageBonus:   0,
      reloadBonus:   0,
      speedBonus:    0,
      lifesteal:     false,
      vampiricRounds: false,  // +2hp per hit
      freeShot:      0,       // chance 0-1
      explosiveRounds: false, // splash on hitscan
      ricochet:      false,   // hitscan penetrate +1
      adrenalineRush: false,  // kill → instant reload
      armorRegen:    false,   // 1 armor / 3s
      lastStand:     false,   // <25% hp → +40% dmg
      doubleTap:     false,   // kill → next shot fires twice
    };
    this._armorRegenTimer = 0;
    this._doubleTapReady  = false;

    // Stats
    this.totalKills = 0;
    this.score      = 0;
    this.alive      = true;
    this.godMode    = false;

    this._keys    = {};
    this._mouseDx = 0;
    this._mouseDy = 0;

    this._bindInput();
  }

  // Convenience getter — always points to current slot
  get weapon() { return this.weapons[this.weaponSlot]; }

  // Check a passive id — works for both classic single-passive and loadout passiveIds array
  _hasPassive(id) {
    if (Array.isArray(this.character.passiveIds)) return this.character.passiveIds.includes(id);
    return this.character.passive?.id === id;
  }

  switchWeapon(slot) {
    if (slot >= 0 && slot < this.weapons.length) this.weaponSlot = slot;
  }

  _bindInput() {
    window.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'KeyR') this.weapon.startReload();
      if (e.code === 'KeyF') this._wantsSkill    = true;
      if (e.code === 'KeyE') this._wantsInteract = true;
      const digit = e.code.match(/^Digit(\d)$/);
      if (digit) this.switchWeapon(parseInt(digit[1]) - 1);
    });
    window.addEventListener('keyup', e => {
      this._keys[e.code] = false;
    });
    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement) {
        this._mouseDx += e.movementX;
        this._mouseDy += e.movementY;
      }
    });
    window.addEventListener('mousedown', e => { if (e.button === 0) this.isFiring = true;  });
    window.addEventListener('mouseup',   e => { if (e.button === 0) this.isFiring = false; });
  }

  update(dt) {
    if (!this.alive) return;

    // HP regen/drain (loadout passive)
    if (this._hpRegenRate !== 0) {
      this._hpRegenTimer -= dt;
      if (this._hpRegenTimer <= 0) {
        this._hpRegenTimer = 5;
        if (this._hpRegenRate > 0) {
          this.healHp(this._hpRegenRate);
        } else {
          this.hp = Math.max(1, this.hp + this._hpRegenRate);
        }
      }
    }

    // Armor regen passive
    if (this.upgrades.armorRegen) {
      this._armorRegenTimer -= dt;
      if (this._armorRegenTimer <= 0) {
        this._armorRegenTimer = 3;
        this.addArmor(1);
      }
    }
    this._updateLook();
    this._updateMovement(dt);
    for (const w of this.weapons) w.update(dt);
    if (this._skillCooldown > 0) this._skillCooldown = Math.max(0, this._skillCooldown - dt);

    // Camera sits at eye level above feet
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_OFFSET,
      this.position.z
    );
  }

  _updateLook() {
    const SENS = 0.002;
    this.yaw   -= this._mouseDx * SENS;
    this.pitch -= this._mouseDy * SENS;
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this._mouseDx = 0;
    this._mouseDy = 0;

    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  _updateMovement(dt) {
    const fwd   = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wishDir = new THREE.Vector3();
    if (this._keys['KeyW'] || this._keys['ArrowUp'])    wishDir.add(fwd);
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  wishDir.sub(fwd);
    if (this._keys['KeyD'] || this._keys['ArrowRight']) wishDir.add(right);
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  wishDir.sub(right);

    const hasInput = wishDir.lengthSq() > 0;
    if (hasInput) wishDir.normalize();

    const speed = MOVE_SPEED * this.speedMult;

    if (this.onGround) {
      this._quakeAccelerate(wishDir, speed, GROUND_ACCEL, dt);

      if (!hasInput) {
        const cur = this.velocity.length();
        if (cur > 0) {
          const drop    = cur * GROUND_FRICTION * dt;
          const newSpd  = Math.max(0, cur - drop);
          this.velocity.multiplyScalar(newSpd / cur);
        }
      }

      if (this._keys['Space']) {
        this.velocity.y = JUMP_FORCE;
        this.onGround   = false;
      }
    } else {
      this._quakeAccelerate(wishDir, AIR_MAX_SPEED * this.speedMult, AIR_ACCEL, dt);
      this.velocity.y -= GRAVITY * dt;
    }

    // Integrate position
    const next = this.position.clone().addScaledVector(this.velocity, dt);

    // Resolve collisions
    const resolved = this.collision.resolve(next, PLAYER_RADIUS, PLAYER_HEIGHT);

    // Stop horizontal velocity if pushed back
    if (Math.abs(resolved.x - next.x) > 0.001) this.velocity.x = 0;
    if (Math.abs(resolved.z - next.z) > 0.001) this.velocity.z = 0;

    // Ground detection
    const floorY = this.collision.getFloorY(resolved, PLAYER_RADIUS);
    if (resolved.y <= floorY + 0.05) {
      resolved.y      = floorY;
      this.velocity.y = 0;
      this.onGround   = true;
    } else {
      this.onGround = false;
    }

    // Ceiling hard clamp — player head must stay below ceiling (wallHeight - small gap)
    const ceilY = (this.collision.ceilingY ?? 6) - PLAYER_HEIGHT - 0.05;
    if (resolved.y > ceilY) {
      resolved.y      = ceilY;
      this.velocity.y = Math.min(0, this.velocity.y); // kill upward momentum
    }

    this.position.copy(resolved);
  }

  _quakeAccelerate(wishDir, wishSpeed, accel, dt) {
    const cur = this.velocity.dot(wishDir);
    const add = wishSpeed - cur;
    if (add <= 0) return;
    const accelAmt = Math.min(accel * wishSpeed * dt, add);
    this.velocity.addScaledVector(wishDir, accelAmt);
  }

  // ── Interact (E key) ────────────────────────────────────────────────────────
  /** Consumes the E key press. Returns true once per press. */
  tryInteract() {
    if (!this._wantsInteract) return false;
    this._wantsInteract = false;
    return true;
  }

  /**
   * Attempt to pick up a weapon by id.
   * - Empty slot available → adds weapon there, returns null.
   * - All slots full → replaces current slot, returns old weapon id.
   */
  pickupWeapon(weaponId) {
    // Check for empty slot
    const emptySlot = this.weapons.findIndex((_, i) => i >= this.weapons.length);
    if (this.weapons.length < this.MAX_WEAPON_SLOTS) {
      this.weapons.push(new WeaponState(weaponId));
      return null; // no weapon displaced
    }
    // All full — swap current slot
    const oldId = this.weapons[this.weaponSlot].def.id;
    this.weapons[this.weaponSlot] = new WeaponState(weaponId);
    return oldId;
  }

  // ── Active Skill ────────────────────────────────────────────────────────────
  /**
   * Attempt to use the active skill.
   * Returns { skillId, aimRay } if the skill fires, or null if unavailable.
   * Consumes the key press regardless so holding F doesn't auto-repeat.
   */
  tryUseSkill() {
    if (!this._wantsSkill) return null;
    this._wantsSkill = false;
    const skill = this.character.activeSkill;
    if (!skill || this._skillCooldown > 0) return null;
    this._skillCooldown = this._skillMaxCooldown;
    return { skillId: skill.id, aimRay: this._getAimRay() };
  }

  // ── Firing ──────────────────────────────────────────────────────────────────
  tryFire(onShot) {
    if (!this.weapon.canFire) return false;
    this.weapon.consume();
    // Free Shot: chance to refund the ammo just consumed
    if (this.upgrades.freeShot > 0 && Math.random() < this.upgrades.freeShot) {
      this.weapon.ammo = Math.min(this.weapon.def.magSize ?? 999, this.weapon.ammo + 1);
    }
    const dmgMult = this._getFinalDamage();
    this.nextShotDouble = false;
    onShot(this._getAimRay(), dmgMult);
    // Double Tap: fire second shot without consuming ammo
    if (this._doubleTapReady) {
      this._doubleTapReady = false;
      onShot(this._getAimRay(), dmgMult);
    }
    return true;
  }

  _getFinalDamage() {
    let mult = this.damageMultiplier * (1 + this.upgrades.damageBonus);
    if (this.weapon._dmgBonus) mult *= (1 + this.weapon._dmgBonus);
    if (this._hasPassive('combat_instinct') && this.nextShotDouble) mult *= 2;
    if (this.upgrades.lastStand && this.hp / this.maxHp < 0.25) mult *= 1.4;
    return mult;
  }

  _getAimRay() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return { origin: this.camera.position.clone(), direction: dir };
  }

  getViewDirection() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }

  // ── Damage / Health ─────────────────────────────────────────────────────────
  takeDamage(amount) {
    if (!this.alive || this.godMode) return;
    if (this.armor > 0) {
      const rate   = this._hasPassive('heavy_armor') ? 0.80 : 0.67;
      const absorb = Math.min(this.armor, amount * rate);
      this.armor  -= absorb;
      amount      -= absorb;
    }
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.alive = false;
    this.killStreak    = 0;
    this.nextShotDouble = false;
  }

  healHp(amount)    { this.hp    = Math.min(this.maxHp,    this.hp    + amount); }
  addArmor(amount)  { this.armor = Math.min(this.maxArmor, this.armor + amount); }

  onKill() {
    this.totalKills++;
    this.score += 100;
    if (this._hasPassive('combat_instinct')) {
      this.killStreak++;
      if (this.killStreak >= 3) { this.nextShotDouble = true; this.killStreak = 0; }
    }
    if (this.upgrades.lifesteal)     this.healHp(4);
    if (this.upgrades.adrenalineRush) {
      // Instantly complete current reload
      const w = this.weapon;
      if (w.reloading) {
        const needed = w.def.magSize - w.ammo;
        const take   = Math.min(needed, w.reserve);
        w.ammo    += take;
        w.reserve -= take;
        w.reloading      = false;
        w.reloadProgress = 0;
      }
    }
    if (this.upgrades.doubleTap) this._doubleTapReady = true;
  }

  // Called by shooting system on every successful hit
  onHit() {
    if (this.upgrades.vampiricRounds) this.healHp(2);
  }

  // ── Upgrade (Phase 4) ────────────────────────────────────────────────────────
  // upg: full upgrade object from UpgradeMenu (has .id, ._weaponId, ._statKey, etc.)
  applyUpgrade(upg) {
    // Backwards-compat: accept raw id string from old code paths
    const id = (typeof upg === 'string') ? upg : upg.id;
    this.upgradeLevel++;

    // ── General upgrades ────────────────────────────────────────────────────
    switch (id) {
      case 'max_hp':    this.maxHp    += 30; this.healHp(30);   return;
      case 'armor':     this.maxArmor += 35; this.addArmor(35); return;
      case 'damage':    this.upgrades.damageBonus  += 0.20;     return;
      case 'reload':    this.upgrades.reloadBonus  += 0.25;     return;
      case 'speed':     this.upgrades.speedBonus   += 0.12;
                        this.speedMult = this.character.baseStats.moveSpeed *
                                         (1 + this.upgrades.speedBonus);    return;
      case 'lifesteal': this.upgrades.lifesteal     = true;     return;
    }

    // ── Milestone passives ───────────────────────────────────────────────────
    if (id.startsWith('passive_')) {
      if (!this.passives.includes(id)) this.passives.push(id);
      switch (id) {
        case 'passive_free_shot':         this.upgrades.freeShot       += 0.15; break;
        case 'passive_explosive_rounds':  this.upgrades.explosiveRounds = true; break;
        case 'passive_ricochet':          this.upgrades.ricochet        = true; break;
        case 'passive_vampiric_rounds':   this.upgrades.vampiricRounds  = true; break;
        case 'passive_adrenaline_rush':   this.upgrades.adrenalineRush  = true; break;
        case 'passive_armor_regen':       this.upgrades.armorRegen      = true; break;
        case 'passive_last_stand':        this.upgrades.lastStand       = true; break;
        case 'passive_double_tap':        this.upgrades.doubleTap       = true; break;
      }
      return;
    }

    // ── Weapon stat upgrades ─────────────────────────────────────────────────
    if (id.startsWith('weapon_') && upg._weaponId) {
      const ws = this.weapons.find(w => w.def.id === upg._weaponId);
      if (!ws) return;
      switch (upg._statKey) {
        case 'damage':
          ws._dmgBonus = (ws._dmgBonus ?? 0) + (upg._pct / 100);
          break;
        case 'magSize': {
          ws.def = { ...ws.def }; // shallow copy so we don't mutate shared def
          ws.def.magSize   += upg._amt;
          ws.ammo          += upg._amt; // fill the extra rounds immediately
          break;
        }
        case 'reloadTime':
          ws.def = { ...ws.def };
          ws.def.reloadTime = Math.max(0.2, ws.def.reloadTime * (1 - upg._pct / 100));
          break;
        case 'reserveAmmo':
          ws.def = { ...ws.def };
          ws.def.reserveAmmo += upg._amt;
          ws.reserve         += upg._amt;
          break;
      }
    }
  }

  getHUDState() {
    return {
      hp: this.hp, maxHp: this.maxHp,
      armor: this.armor, maxArmor: this.maxArmor,
      // Current weapon (kept for legacy / skill-bar code that still reads it)
      ammo: this.weapon.ammo, reserve: this.weapon.reserve,
      weaponName: this.weapon.def.name,
      reloading: this.weapon.reloading,
      reloadProgress: this.weapon.reloadProgress / (this.weapon.def.reloadTime || 1),
      kills: this.totalKills, score: this.score,
      nextShotDouble: this.nextShotDouble,
      skillName:        this.character.activeSkill?.name        ?? null,
      skillCooldown:    this._skillCooldown,
      skillMaxCooldown: this._skillMaxCooldown,
      // All weapon slots — drives the weapon-slot HUD strip
      weaponSlot: this.weaponSlot,
      weapons: this.weapons.map(w => ({
        id:           w.def.id,
        name:         w.def.name,
        shortName:    w.def.shortName ?? w.def.id.slice(0, 2).toUpperCase(),
        ammo:         w.ammo,
        reserve:      w.reserve,
        magSize:      w.def.magSize  ?? 0,
        reloading:    w.reloading,
        reloadPct:    w.reloading
                        ? w.reloadProgress / (w.def.reloadTime || 1)
                        : w.ammo / (w.def.magSize || 1),
        type:         w.def.type,
      })),
    };
  }
}
