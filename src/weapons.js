// Weapon definitions and firing logic

export const WEAPON_DEFS = {
  fists: {
    id: 'fists',
    name: 'FISTS',
    shortName: 'FT',
    type: 'melee',
    damage: 80,
    range: 2.4,
    fireRate: 0.55,
    reloadTime: 0,
    magSize: 0,
    reserveAmmo: 0,
  },
  shotgun: {
    id: 'shotgun',
    name: 'SHOTGUN',
    shortName: 'SG',
    type: 'hitscan',
    damage: 15,         // per pellet
    pellets: 7,
    spread: 0.08,       // radians
    fireRate: 0.9,      // seconds between shots
    reloadTime: 1.8,
    magSize: 8,
    reserveAmmo: 64,
    range: 40,
    knockback: 3,
  },
  railgun: {
    id: 'railgun',
    name: 'RAILGUN',
    shortName: 'RG',
    type: 'hitscan',
    damage: 120,
    pellets: 1,
    spread: 0,
    fireRate: 1.5,
    reloadTime: 2.2,
    magSize: 5,
    reserveAmmo: 30,
    range: 200,
    penetrate: true,    // passes through multiple enemies
    knockback: 8,
  },
  rocket: {
    id: 'rocket',
    name: 'ROCKET',
    shortName: 'RL',
    type: 'projectile',
    damage: 80,
    splashRadius: 4,
    splashDamage: 60,
    splashPush: 18,       // impulse applied to anything in splash radius
    speed: 14,
    fireRate: 1.2,
    reloadTime: 2.0,
    magSize: 4,
    reserveAmmo: 20,
    knockback: 12,
    projectileColor:  '#ff8800',
    projectileScaleX: 0.35,
    projectileScaleY: 0.35,
    minTravel: 1.8,
  },
  machinegun: {
    id: 'machinegun',
    name: 'MACHINE GUN',
    shortName: 'MG',
    type: 'hitscan',
    damage: 12,
    pellets: 1,
    spread: 0.045,
    fireRate: 0.09,     // ~11 rounds/sec
    reloadTime: 2.2,
    magSize: 35,
    reserveAmmo: 140,
    range: 65,
  },
  nailgun: {
    id: 'nailgun',
    name: 'NAIL GUN',
    shortName: 'NG',
    type: 'projectile',
    damage: 45,
    speed: 22,
    spread: 0.025,
    fireRate: 0.28,
    reloadTime: 1.8,
    magSize: 20,
    reserveAmmo: 80,
    splashRadius: 0,
    splashDamage: 0,
    projectileColor:  '#aaddff',
    projectileScaleX: 0.12,
    projectileScaleY: 0.36,
    minTravel: 0.5,
  },
};

export class WeaponState {
  constructor(defId) {
    this.def = WEAPON_DEFS[defId];
    this.ammo = this.def.magSize;
    this.reserve = this.def.reserveAmmo;
    this.cooldown = 0;       // time until can fire again
    this.reloading = false;
    this.reloadProgress = 0;
  }

  get canFire() {
    if (this.def.type === 'melee') return this.cooldown <= 0;
    return !this.reloading && this.cooldown <= 0 && this.ammo > 0;
  }

  get isEmpty() {
    if (this.def.type === 'melee') return false;
    return this.ammo === 0;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.def.type === 'melee') return;

    if (this.reloading) {
      this.reloadProgress += dt;
      if (this.reloadProgress >= this.def.reloadTime) {
        const needed = this.def.magSize - this.ammo;
        const take = Math.min(needed, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloading = false;
        this.reloadProgress = 0;
      }
    }
  }

  startReload() {
    if (this.def.type === 'melee') return false;
    if (this.reloading || this.ammo === this.def.magSize || this.reserve === 0) return false;
    this.reloading = true;
    this.reloadProgress = 0;
    return true;
  }

  consume() {
    this.cooldown = this.def.fireRate;
    if (this.def.type === 'melee') return;
    this.ammo--;
    if (this.ammo === 0 && this.reserve > 0) this.startReload();
  }

  addAmmo(amount) {
    if (this.def.type === 'melee') return;
    this.reserve = Math.min(this.reserve + amount, this.def.reserveAmmo * 2);
  }
}
