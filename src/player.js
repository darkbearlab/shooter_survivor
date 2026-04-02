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
    this.armor    = s.maxArmor;
    this.speedMult          = s.moveSpeed;
    this.damageMultiplier   = s.damageMultiplier;
    this.reloadMultiplier   = s.reloadMultiplier;

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

    // Upgrades (Phase 4)
    this.upgrades = { damageBonus: 0, reloadBonus: 0, lifesteal: false };

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
    const dmgMult = this._getFinalDamage();
    this.nextShotDouble = false;
    onShot(this._getAimRay(), dmgMult);
    return true;
  }

  _getFinalDamage() {
    let mult = this.damageMultiplier * (1 + this.upgrades.damageBonus);
    if (this.character.passive.id === 'combat_instinct' && this.nextShotDouble) mult *= 2;
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
      const rate   = this.character.passive.id === 'heavy_armor' ? 0.80 : 0.67;
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
    if (this.character.passive.id === 'combat_instinct') {
      this.killStreak++;
      if (this.killStreak >= 3) { this.nextShotDouble = true; this.killStreak = 0; }
    }
    if (this.upgrades.lifesteal) this.healHp(3);
  }

  // ── Upgrade (Phase 4) ────────────────────────────────────────────────────────
  applyUpgrade(id) {
    switch (id) {
      case 'max_hp':  this.maxHp    += 25; this.healHp(25);  break;
      case 'armor':   this.maxArmor += 30; this.addArmor(30); break;
      case 'damage':  this.upgrades.damageBonus  += 0.15; break;
      case 'reload':  this.upgrades.reloadBonus  += 0.20; break;
      case 'lifesteal': this.upgrades.lifesteal   = true;  break;
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
