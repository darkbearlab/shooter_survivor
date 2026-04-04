// enemies.js — Enemy class + WaveManager
// Supports: soldier, rusher, ranged, boss,
//           molotov, trishot, sniper, tank, guerrilla, drone_gun, drone_bomb

import * as THREE from 'three';
import { makeEnemyTexture, makeBossTexture } from './utils/PlaceholderTextures.js';

const GRAVITY_E = 22; // matches player gravity

const TEXTURES = {
  soldier:        makeEnemyTexture('soldier'),
  rusher:         makeEnemyTexture('rusher'),
  ranged:         makeEnemyTexture('ranged'),
  boss:           makeBossTexture(),
  boss_rocketeer: makeBossTexture(),
  boss_charger:   makeBossTexture(),
  boss_dasher:    makeBossTexture(),
  molotov:        makeEnemyTexture('molotov'),
  trishot:        makeEnemyTexture('trishot'),
  sniper:         makeEnemyTexture('sniper'),
  tank:           makeEnemyTexture('tank'),
  guerrilla:      makeEnemyTexture('guerrilla'),
  drone_gun:      makeEnemyTexture('drone_gun'),
  drone_bomb:     makeEnemyTexture('drone_bomb'),
};

export const ENEMY_DEFS = {
  // ── Original types ──────────────────────────────────────────────────────────
  soldier:  { hp: 80,  speed: 3.5, damage: 10, attackRate: 1.2, attackRange: 1.6,
              width: 1.0, height: 1.8, hbHalfW: 0.4, score: 100 },
  rusher:   { hp: 45,  speed: 6.5, damage: 18, attackRate: 0.8, attackRange: 1.4,
              width: 0.9, height: 1.6, hbHalfW: 0.35, score: 150 },
  ranged:   { hp: 55,  speed: 2.8, damage: 8,  attackRate: 2.0, attackRange: 18,
              width: 1.0, height: 1.8, hbHalfW: 0.4, score: 120,
              projectile: true, preferDist: 10 },
  boss:     { hp: 500, speed: 3.0, damage: 25, attackRate: 1.0, attackRange: 2.2,
              width: 2.0, height: 2.8, hbHalfW: 0.8, score: 1000,
              displayName: 'THE WARDEN', isBossType: true },
  boss_rocketeer: { hp: 600, speed: 2.8, damage: 28, attackRate: 4.5, attackRange: 28,
                    width: 2.0, height: 2.8, hbHalfW: 0.8, score: 1200,
                    displayName: 'THE ROCKETEER', isBossType: true, bossRocketeer: true },
  boss_charger:   { hp: 700, speed: 2.8, damage: 35, attackRate: 3.0, attackRange: 2.0,
                    width: 2.0, height: 2.8, hbHalfW: 0.8, score: 1500,
                    displayName: 'THE CHARGER',   isBossType: true, bossCharger: true },
  boss_dasher:    { hp: 550, speed: 22,  damage: 55, attackRate: 0,   attackRange: 0,
                    width: 2.0, height: 2.8, hbHalfW: 0.8, score: 1300,
                    displayName: 'THE PHANTOM',   isBossType: true, bossDasher: true },

  // ── New types ────────────────────────────────────────────────────────────────
  molotov:   { hp: 70,  speed: 2.5, damage: 8,  attackRate: 4.0, attackRange: 22,
               width: 1.0, height: 1.8, hbHalfW: 0.4, score: 180,
               projectile: true, preferDist: 14 },

  trishot:   { hp: 75,  speed: 3.0, damage: 10, attackRate: 2.8, attackRange: 20,
               width: 1.0, height: 1.8, hbHalfW: 0.4, score: 200,
               projectile: true, tripleShot: true, preferDist: 10 },

  sniper:    { hp: 60,  speed: 1.8, damage: 45, attackRate: 5.0, attackRange: 35,
               width: 1.0, height: 1.8, hbHalfW: 0.4, score: 260,
               sniper: true, preferDist: 20 },

  tank:      { hp: 600, speed: 1.2, damage: 40, attackRate: 3.5, attackRange: 30,
               width: 2.0, height: 2.2, hbHalfW: 0.7, score: 400,
               projectile: true, rocketTank: true, preferDist: 16 },

  guerrilla: { hp: 90,  speed: 6.5, damage: 35, attackRate: 3.2, attackRange: 15,
               width: 1.0, height: 1.8, hbHalfW: 0.4, score: 300,
               guerrilla: true },

  drone_gun: { hp: 40,  speed: 5.0, damage: 12, attackRate: 0.4, attackRange: 18,
               width: 0.8, height: 0.8, hbHalfW: 0.35, score: 200,
               drone: true, droneType: 'gun' },

  drone_bomb:{ hp: 35,  speed: 7.0, damage: 70, attackRate: 99,  attackRange: 1.8,
               width: 0.8, height: 0.8, hbHalfW: 0.35, score: 220,
               drone: true, droneType: 'bomb' },
};

// ── Enemy ────────────────────────────────────────────────────────────────────

export class Enemy {
  constructor(type, x, z, scene, collision) {
    this.type      = type;
    this.def       = ENEMY_DEFS[type];
    this.hp        = this.def.hp;
    this.maxHp     = this.def.hp;
    this.alive     = true;
    this.scene     = scene;
    this.collision = collision;

    this.pos      = new THREE.Vector3(x, 0, z);
    this.velocity = new THREE.Vector3();

    this.hbHalfW = this.def.hbHalfW;
    this.hbH     = this.def.height;

    this.attackCooldown = Math.random() * this.def.attackRate;
    this._strafeSign    = Math.random() < 0.5 ? 1 : -1;
    this._strafeTimer   = 0;
    this._steerCooldown = 0;

    this.onDeath          = null; // fn(pos, type)
    this.onSpecialAttack  = null; // fn(enemy, data) — sniper shot, kamikaze

    this._kbVelX  = 0;
    this._kbVelZ  = 0;
    this._kbTimer = 0;

    // Type-specific state
    this._initTypeState();

    // Sprite
    const mat = new THREE.SpriteMaterial({
      map: TEXTURES[type] ?? TEXTURES.soldier,
      transparent: true, alphaTest: 0.1,
    });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(this.def.width, this.def.height, 1);
    this._mat = mat;
    scene.add(this.sprite);

    // HP bar (foreground only — depthTest true so it never shows through walls)
    const fgMat = new THREE.SpriteMaterial({ color: 0x00dd44, depthTest: true, depthWrite: false });
    this._hpFg  = new THREE.Sprite(fgMat);
    scene.add(this._hpFg);

    this._updateVisuals();
  }

  _initTypeState() {
    const d = this.def;

    if (d.sniper) {
      this._sniperState   = 'idle';
      this._aimTarget     = null;
      this._aimTimer      = 0;
      this._aimBlinkTimer = 0;
      this._laserLine     = null;
      this._laserPos      = null;
    }

    if (d.guerrilla) {
      this._gState     = 'hunt';
      this._leapActive = false;
      this._velY       = 0;
      this._leapVelX   = 0;
      this._leapVelZ   = 0;
    }

    if (d.drone) {
      this._droneState = 'approach';
      this._droneTimer = 0;
      this._velY       = 0;
      this._orbitAngle = Math.random() * Math.PI * 2;
      this._floatPhase = Math.random() * Math.PI * 2;
      this._burstCount = 0;
      this._burstTimer = 0;
      this._diveTarget = null;
      this.pos.y       = 2 + Math.random() * 2; // spawn airborne
    }

    if (d.bossRocketeer) {
      this.attackCooldown = 2.0 + Math.random(); // brief calm before first volley
    }

    if (d.bossCharger) {
      this._chargeState  = 'idle';
      this._chargeTimer  = 0;
      this._chargeCount  = 0;
      this._chargeDir    = new THREE.Vector3();
      this._chargeHit    = false;
      this._blinkTimer   = 0;
    }

    if (d.bossDasher) {
      this._dashState    = 'pausing';
      this._dashTimer    = 0.6 + Math.random() * 0.4;
      this._dashCount    = 0;
      this._dashMax      = 4 + Math.floor(Math.random() * 3); // 4–6 dashes
      this._dashDir      = new THREE.Vector3();
      this._dashAimTarget = null; // locked player pos when warning begins
      this._ghostTimer   = 0;
      this._blinkTimer   = 0;
      this._afterimages  = [];
    }
  }

  // ── Ray vs AABB (used by shooting system) ────────────────────────────────

  rayIntersect(origin, dir) {
    const minX = this.pos.x - this.hbHalfW, maxX = this.pos.x + this.hbHalfW;
    const minY = this.pos.y,                maxY = this.pos.y + this.hbH;
    const minZ = this.pos.z - this.hbHalfW, maxZ = this.pos.z + this.hbHalfW;

    let tmin = -Infinity, tmax = Infinity;
    for (const [o, d, lo, hi] of [
      [origin.x, dir.x, minX, maxX],
      [origin.y, dir.y, minY, maxY],
      [origin.z, dir.z, minZ, maxZ],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (o < lo || o > hi) return Infinity;
      } else {
        const t1 = (lo - o) / d, t2 = (hi - o) / d;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
    }
    if (tmax < 0 || tmin > tmax) return Infinity;
    return tmin < 0 ? tmax : tmin;
  }

  // ── Main update ──────────────────────────────────────────────────────────

  update(dt, playerPos, onAttackPlayer, onFireProjectile, allEnemies, bounds) {
    if (!this.alive) return;

    this.attackCooldown -= dt;

    const dx   = playerPos.x - this.pos.x;
    const dz   = playerPos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const nx   = dist > 0.01 ? dx / dist : 0;
    const nz   = dist > 0.01 ? dz / dist : 0;

    const d = this.def;

    // ── Type dispatch ────────────────────────────────────────────────────────
    if (d.sniper) {
      this._ticSniper(dt, playerPos, dist, nx, nz);
    } else if (d.guerrilla) {
      this._ticGuerrilla(dt, playerPos, dist, nx, nz, onFireProjectile);
    } else if (d.drone) {
      this._ticDrone(dt, playerPos, dist, nx, nz, onFireProjectile);
    } else if (d.bossRocketeer) {
      this._ticBossRocketeer(dt, dist, nx, nz, onFireProjectile);
    } else if (d.bossCharger) {
      this._ticBossCharger(dt, dist, nx, nz, onAttackPlayer);
    } else if (d.bossDasher) {
      this._ticBossDasher(dt, dist, nx, nz);
    } else if (d.projectile) {
      this._ticRanged(dt, dist, nx, nz, onFireProjectile);
    } else {
      this._ticMelee(dt, dist, nx, nz, onAttackPlayer);
    }

    // ── Wall steering (ground only, not leaping, not mid-charge) ─────────────
    const isFlying     = d.drone || this._leapActive;
    const skipSteering = isFlying
      || (d.bossCharger && this._chargeState === 'charge')
      || (d.bossDasher  && this._dashState   === 'dashing');
    if (!skipSteering && this.collision && this.velocity.lengthSq() > 0.01) {
      this._steerCooldown -= dt;
      if (this._steerCooldown <= 0) {
        this._steerCooldown = 0.12;
        const PROBE = 1.2;
        const moveDir    = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize();
        const probeOrigin = new THREE.Vector3(this.pos.x, 0.9, this.pos.z);
        const frontDist  = this.collision.raycast(probeOrigin, moveDir, PROBE);
        if (frontDist < PROBE) {
          const leftDir  = new THREE.Vector3(-moveDir.z, 0,  moveDir.x);
          const rightDir = new THREE.Vector3( moveDir.z, 0, -moveDir.x);
          const leftDist  = this.collision.raycast(probeOrigin, leftDir,  PROBE);
          const rightDist = this.collision.raycast(probeOrigin, rightDir, PROBE);
          const blendDir  = leftDist >= rightDist ? leftDir : rightDir;
          const newDir    = moveDir.clone().multiplyScalar(0.3).addScaledVector(blendDir, 0.7).normalize();
          const spd       = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
          this.velocity.set(newDir.x * spd, 0, newDir.z * spd);
        }
      }
    }

    // ── Knockback ────────────────────────────────────────────────────────────
    let kbX = 0, kbZ = 0;
    if (this._kbTimer > 0 && !this._leapActive) {
      const frac = this._kbTimer / 0.3;
      kbX = this._kbVelX * frac * dt;
      kbZ = this._kbVelZ * frac * dt;
      this._kbTimer -= dt;
      if (this._kbTimer < 0) this._kbTimer = 0;
    }

    // ── Integration ──────────────────────────────────────────────────────────
    if (this._leapActive) {
      // Guerrilla leap — gravity, no collision
      this.pos.x += this._leapVelX * dt;
      this.pos.z += this._leapVelZ * dt;
      this._velY -= GRAVITY_E * dt;
      this.pos.y += this._velY * dt;
      if (this.pos.y <= 0) {
        this.pos.y    = 0;
        this._velY    = 0;
        this._leapVelX = 0;
        this._leapVelZ = 0;
        this._leapActive = false;
        this._gState  = 'hunt';
        this.attackCooldown = this.def.attackRate + Math.random();
      }

    } else if (d.drone) {
      // Drone — XZ direct, Y handled inside _ticDrone
      this.pos.x += this.velocity.x * dt;
      this.pos.z += this.velocity.z * dt;

    } else {
      // Ground — AABB-resolved XZ, y clamped to 0
      const nextX = this.pos.x + this.velocity.x * dt + kbX;
      const nextZ = this.pos.z + this.velocity.z * dt + kbZ;
      if (this.collision) {
        const resolved = this.collision.resolve(
          new THREE.Vector3(nextX, 0, nextZ), this.hbHalfW, this.hbH,
        );
        this.pos.x = resolved.x;
        this.pos.z = resolved.z;
      } else {
        this.pos.x = nextX;
        this.pos.z = nextZ;
      }
      this.pos.y = 0;
    }

    // ── Bounds + separation (ground enemies only) ─────────────────────────────
    if (!isFlying) {
      this.pos.x = Math.max(bounds.minX + this.hbHalfW,
                   Math.min(bounds.maxX - this.hbHalfW, this.pos.x));
      this.pos.z = Math.max(bounds.minZ + this.hbHalfW,
                   Math.min(bounds.maxZ - this.hbHalfW, this.pos.z));

      for (const other of allEnemies) {
        if (other === this || !other.alive || other.def.drone) continue;
        const ex = this.pos.x - other.pos.x, ez = this.pos.z - other.pos.z;
        const d2 = ex * ex + ez * ez;
        const minD = this.hbHalfW + other.hbHalfW + 0.05;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d  = Math.sqrt(d2);
          const push = (minD - d) * 0.5;
          this.pos.x += (ex / d) * push;
          this.pos.z += (ez / d) * push;
        }
      }
    }

    this._updateVisuals();
  }

  // ── Behaviour methods ────────────────────────────────────────────────────

  _ticMelee(dt, dist, nx, nz, onAttackPlayer) {
    this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);
    if (dist < this.def.attackRange && this.attackCooldown <= 0) {
      this.attackCooldown = this.def.attackRate;
      onAttackPlayer(this.def.damage);
      this.applyKnockback(-nx, -nz, 12);
    }
  }

  _ticRanged(dt, dist, nx, nz, onFireProjectile) {
    const pref = this.def.preferDist ?? 10;
    const tooClose = dist < pref - 2, tooFar = dist > pref + 2;

    this._strafeTimer -= dt;
    if (this._strafeTimer <= 0) {
      this._strafeSign  = -this._strafeSign;
      this._strafeTimer = 1.5 + Math.random();
    }
    const sx = -nz * this._strafeSign, sz = nx * this._strafeSign;

    if (tooClose) {
      this.velocity.set(-nx * this.def.speed, 0, -nz * this.def.speed);
    } else if (tooFar) {
      this.velocity.set(nx * this.def.speed * 0.7, 0, nz * this.def.speed * 0.7);
    } else {
      this.velocity.set(sx * this.def.speed * 0.5, 0, sz * this.def.speed * 0.5);
    }

    if (this.attackCooldown <= 0 && dist < this.def.attackRange) {
      this.attackCooldown = this.def.attackRate;
      if (onFireProjectile) onFireProjectile(this);
    }
  }

  _ticSniper(dt, playerPos, dist, nx, nz) {
    const pref = this.def.preferDist;

    if (this._sniperState === 'idle') {
      // Slow strafe at preferred distance
      if (dist > pref + 5) {
        this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);
      } else if (dist < pref - 3) {
        this.velocity.set(-nx * this.def.speed * 0.5, 0, -nz * this.def.speed * 0.5);
      } else {
        this._strafeTimer -= dt;
        if (this._strafeTimer <= 0) {
          this._strafeSign  = -this._strafeSign;
          this._strafeTimer = 2.0 + Math.random();
        }
        this.velocity.set(
          -nz * this._strafeSign * this.def.speed * 0.4, 0,
           nx * this._strafeSign * this.def.speed * 0.4,
        );
      }

      // Begin aiming when ready and in range
      if (this.attackCooldown <= 0 && dist < this.def.attackRange) {
        this._sniperState   = 'aiming';
        this._aimTarget     = playerPos.clone();
        this._aimTimer      = 1.5;
        this._aimBlinkTimer = 0;
        this.velocity.set(0, 0, 0);
      }

    } else if (this._sniperState === 'aiming') {
      this.velocity.set(0, 0, 0); // stand still during aim

      this._aimTimer      -= dt;
      this._aimBlinkTimer -= dt;

      // Lazy-init laser line
      if (!this._laserLine) {
        const positions = new Float32Array(6);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 });
        this._laserLine = new THREE.Line(geo, mat);
        this._laserPos  = positions;
        this.scene.add(this._laserLine);
      }

      // Update laser geometry (sniper head → aim target chest height)
      const headY = this.pos.y + this.hbH * 0.85;
      this._laserPos[0] = this.pos.x; this._laserPos[1] = headY; this._laserPos[2] = this.pos.z;
      this._laserPos[3] = this._aimTarget.x;
      this._laserPos[4] = this._aimTarget.y + 1.0;
      this._laserPos[5] = this._aimTarget.z;
      this._laserLine.geometry.attributes.position.needsUpdate = true;

      // Blink
      if (this._aimBlinkTimer <= 0) {
        this._aimBlinkTimer = 0.1;
        this._laserLine.visible = !this._laserLine.visible;
      }

      // Fire
      if (this._aimTimer <= 0) {
        if (this._laserLine) this._laserLine.visible = false;
        if (this.onSpecialAttack) {
          this.onSpecialAttack(this, {
            type:      'sniper_shot',
            from:      new THREE.Vector3(this.pos.x, this.pos.y + this.hbH * 0.85, this.pos.z),
            aimTarget: this._aimTarget.clone(),
          });
        }
        this._sniperState = 'idle';
        this.attackCooldown = this.def.attackRate;
      }
    }
  }

  _ticGuerrilla(dt, playerPos, dist, nx, nz, onFireProjectile) {
    if (this._leapActive) return; // physics handled in main update()

    if (this._gState === 'hunt') {
      if (dist > 15) {
        this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);
      } else if (dist < 7) {
        this.velocity.set(-nx * this.def.speed * 0.7, 0, -nz * this.def.speed * 0.7);
      } else {
        this._strafeTimer -= dt;
        if (this._strafeTimer <= 0) {
          this._strafeSign  = -this._strafeSign;
          this._strafeTimer = 1.0 + Math.random();
        }
        this.velocity.set(
          -nz * this._strafeSign * this.def.speed * 0.55, 0,
           nx * this._strafeSign * this.def.speed * 0.55,
        );
      }

      if (this.attackCooldown <= 0 && dist < this.def.attackRange) {
        this._gState = 'firing';
        this.velocity.set(0, 0, 0);
      }

    } else if (this._gState === 'firing') {
      this.velocity.set(0, 0, 0);
      this.attackCooldown = this.def.attackRate;
      if (onFireProjectile) onFireProjectile(this);

      // Begin leap — away from player with random spread
      this._leapActive = true;
      this._velY       = 14 + Math.random() * 4;
      const awayAngle  = Math.atan2(-nz, -nx) + (Math.random() - 0.5) * 1.4;
      const leapSpd    = 10 + Math.random() * 4;
      this._leapVelX   = Math.cos(awayAngle) * leapSpd;
      this._leapVelZ   = Math.sin(awayAngle) * leapSpd;
      // _gState reset to 'hunt' on landing (see main update)
    }
  }

  _ticDrone(dt, playerPos, dist, nx, nz, onFireProjectile) {
    this._droneTimer -= dt;
    this._floatPhase += dt * 1.5;

    // Spring Y toward hover height
    const hoverY = playerPos.y + 3.5 + Math.sin(this._floatPhase) * 0.5;
    const dyToTarget = hoverY - this.pos.y;
    this._velY += dyToTarget * 6 * dt;
    this._velY *= Math.pow(0.8, dt * 60); // damping
    this.pos.y  = Math.max(1.5, this.pos.y + this._velY * dt);

    if (this._droneState === 'approach') {
      this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);
      if (dist < 8) {
        this._droneState = 'orbit';
        this._droneTimer = 1.8 + Math.random();
      }

    } else if (this._droneState === 'orbit') {
      // Circle the player
      this._orbitAngle += dt * 1.2;
      const oR      = 6;
      const tX      = playerPos.x + Math.cos(this._orbitAngle) * oR;
      const tZ      = playerPos.z + Math.sin(this._orbitAngle) * oR;
      const toTX    = tX - this.pos.x, toTZ = tZ - this.pos.z;
      const toTLen  = Math.sqrt(toTX * toTX + toTZ * toTZ) || 1;
      this.velocity.set(
        (toTX / toTLen) * this.def.speed * 0.7, 0,
        (toTZ / toTLen) * this.def.speed * 0.7,
      );

      if (this._droneTimer <= 0) {
        if (this.def.droneType === 'gun') {
          this._droneState = 'attack';
          this._burstCount = 3;
          this._burstTimer = 0;
        } else {
          this._droneState = 'dive';
          this._diveTarget = playerPos.clone();
        }
      }

    } else if (this._droneState === 'attack') {
      this.velocity.set(0, 0, 0); // hover during burst
      this._burstTimer -= dt;
      if (this._burstCount > 0 && this._burstTimer <= 0) {
        if (onFireProjectile) onFireProjectile(this);
        this._burstCount--;
        this._burstTimer = 0.25;
      }
      if (this._burstCount <= 0 && this._burstTimer <= 0) {
        this._droneState = 'retreat';
        this._droneTimer = 1.2;
      }

    } else if (this._droneState === 'retreat') {
      this.velocity.set(-nx * this.def.speed * 0.8, 0, -nz * this.def.speed * 0.8);
      if (this._droneTimer <= 0) {
        this._droneState = 'approach';
      }

    } else if (this._droneState === 'dive') {
      // Override spring Y — dive toward target
      const dX = this._diveTarget.x - this.pos.x;
      const dY = (this._diveTarget.y + 1.0) - this.pos.y;
      const dZ = this._diveTarget.z - this.pos.z;
      const dLen = Math.sqrt(dX * dX + dY * dY + dZ * dZ) || 1;
      const spd = this.def.speed * 2.5;
      this.velocity.set((dX / dLen) * spd, 0, (dZ / dLen) * spd);
      this._velY = (dY / dLen) * spd; // override spring

      // Proximity check — trigger kamikaze
      const toPx = this.pos.x - playerPos.x;
      const toPy = this.pos.y - (playerPos.y + 1);
      const toPz = this.pos.z - playerPos.z;
      if (Math.sqrt(toPx * toPx + toPy * toPy + toPz * toPz) < this.def.attackRange) {
        if (this.onSpecialAttack) {
          this.onSpecialAttack(this, { type: 'kamikaze', pos: this.pos.clone() });
        }
      }

      // Missed — XZ distance to dive target is small but no hit triggered.
      // Reset to approach so the drone doesn't get stuck.
      const xzDist = Math.sqrt(dX * dX + dZ * dZ);
      if (xzDist < 1.0) {
        this._droneState = 'approach';
        this._droneTimer = 1.5 + Math.random();
        this._diveTarget = null;
      }
    }
  }

  _ticBossRocketeer(dt, dist, nx, nz, onFireProjectile) {
    // Keeps a medium distance and periodically fires a spread of 5 rockets
    const pref = 12;
    if (dist > pref + 3) {
      this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);
    } else if (dist < pref - 3) {
      this.velocity.set(-nx * this.def.speed * 0.6, 0, -nz * this.def.speed * 0.6);
    } else {
      this._strafeTimer -= dt;
      if (this._strafeTimer <= 0) {
        this._strafeSign  = -this._strafeSign;
        this._strafeTimer = 1.5 + Math.random();
      }
      this.velocity.set(
        -nz * this._strafeSign * this.def.speed * 0.45, 0,
         nx * this._strafeSign * this.def.speed * 0.45,
      );
    }

    if (this.attackCooldown <= 0 && dist < this.def.attackRange) {
      this.attackCooldown = this.def.attackRate;
      if (onFireProjectile) onFireProjectile(this, { type: 'boss_rocket' });
    }
  }

  _ticBossCharger(dt, dist, nx, nz, onAttackPlayer) {
    const MAX_CHARGES = 2;
    const CHARGE_SPEED = 18;

    if (this._chargeState === 'idle') {
      // Approach player until ready to charge
      this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);
      if (this.attackCooldown <= 0) {
        this._chargeState = 'windup';
        this._chargeTimer = 1.5;
        this._blinkTimer  = 0;
        this._chargeDir.set(nx, 0, nz);
        this.velocity.set(0, 0, 0);
      }

    } else if (this._chargeState === 'windup') {
      this.velocity.set(0, 0, 0);
      this._chargeTimer -= dt;
      this._blinkTimer  -= dt;
      // Keep updating charge direction toward player until commit
      this._chargeDir.set(nx, 0, nz);
      // Amber / white blink to warn player
      if (this._blinkTimer <= 0) {
        this._blinkTimer = 0.08;
        this._mat.color.setHex(
          this._mat.color.getHex() === 0xff8800 ? 0xffffff : 0xff8800,
        );
      }
      if (this._chargeTimer <= 0) {
        this._mat.color.setHex(0xff2200);
        this._chargeState = 'charge';
        this._chargeTimer = 1.2;
        this._chargeHit   = false;
      }

    } else if (this._chargeState === 'charge') {
      this._chargeTimer -= dt;
      this.velocity.set(
        this._chargeDir.x * CHARGE_SPEED, 0,
        this._chargeDir.z * CHARGE_SPEED,
      );
      // Single contact hit during this charge
      if (!this._chargeHit && dist < this.def.attackRange + 0.5) {
        this._chargeHit = true;
        onAttackPlayer(this.def.damage * 2);
        this.applyKnockback(-nx, -nz, 12);
      }
      if (this._chargeTimer <= 0) {
        this._chargeCount++;
        const longRest = this._chargeCount >= MAX_CHARGES;
        this._chargeTimer = longRest ? 5.0 : 2.0;
        this._chargeState = 'rest';
        if (longRest) this._chargeCount = 0;
        this._mat.color.setHex(0xffffff);
        this.velocity.set(0, 0, 0);
      }

    } else if (this._chargeState === 'rest') {
      this.velocity.set(0, 0, 0);
      this._chargeTimer -= dt;
      if (this._chargeTimer <= 0) {
        if (this._chargeCount === 0) {
          // After long rest — back to idle approach
          this._chargeState   = 'idle';
          this.attackCooldown = this.def.attackRate;
        } else {
          // After short rest — another charge cycle
          this._chargeState = 'windup';
          this._chargeTimer = 1.5;
          this._blinkTimer  = 0;
          this._chargeDir.set(nx, 0, nz);
        }
      }
    }
  }

  _ticBossDasher(dt, dist, nx, nz) {
    this._updateAfterimages(dt);

    if (this._dashState === 'dashing') {
      this.velocity.set(
        this._dashDir.x * this.def.speed, 0,
        this._dashDir.z * this.def.speed,
      );
      // Spawn afterimage trail
      this._ghostTimer -= dt;
      if (this._ghostTimer <= 0) {
        this._ghostTimer = 0.045;
        this._spawnAfterimage();
      }
      this._dashTimer -= dt;
      if (this._dashTimer <= 0) {
        this._dashCount++;
        if (this._dashCount >= this._dashMax) {
          // Enough dashes — lock target NOW, then telegraph with warning flash
          this._dashAimTarget = new THREE.Vector3(
            this.pos.x + nx * 50, 0, this.pos.z + nz * 50,
          );
          this._dashState  = 'warning';
          this._dashTimer  = 0.7;   // how long the warning flash lasts
          this._blinkTimer = 0;
          this.velocity.set(0, 0, 0);
        } else {
          // Brief pause before next dash
          this._dashState = 'pausing';
          this._dashTimer = 0.10 + Math.random() * 0.06;
          this.velocity.set(0, 0, 0);
        }
      }

    } else if (this._dashState === 'pausing') {
      this.velocity.set(0, 0, 0);
      this._dashTimer -= dt;
      if (this._dashTimer <= 0) {
        // Alternate sides with slight forward lean
        this._strafeSign = -this._strafeSign;
        this._dashDir.set(-nz * this._strafeSign, 0, nx * this._strafeSign);
        this._dashDir.addScaledVector(new THREE.Vector3(nx, 0, nz), 0.15);
        this._dashDir.normalize();
        this._dashState  = 'dashing';
        this._dashTimer  = 0.65 + Math.random() * 0.25; // longer dash duration
        this._ghostTimer = 0;
      }

    } else if (this._dashState === 'warning') {
      // Bright orange-white blink — player has time to react
      this.velocity.set(0, 0, 0);
      this._dashTimer  -= dt;
      this._blinkTimer -= dt;
      if (this._blinkTimer <= 0) {
        this._blinkTimer = 0.07;
        this._mat.color.setHex(
          this._mat.color.getHex() === 0xff6600 ? 0xffffff : 0xff6600,
        );
      }
      if (this._dashTimer <= 0) {
        this._dashState  = 'shooting';
        this._dashTimer  = 0.15;  // tiny settle before firing
        this._blinkTimer = 0;
        this._mat.color.setHex(0xffffff);
      }

    } else if (this._dashState === 'shooting') {
      this.velocity.set(0, 0, 0);
      this._dashTimer -= dt;
      if (this._dashTimer <= 0) {
        if (this.onSpecialAttack) {
          this.onSpecialAttack(this, {
            type:      'boss_railgun',
            from:      new THREE.Vector3(this.pos.x, this.pos.y + this.hbH * 0.7, this.pos.z),
            aimTarget: this._dashAimTarget.clone(),
          });
        }
        // Reset dash cycle
        this._dashState  = 'pausing';
        this._dashTimer  = 0.25;
        this._dashCount  = 0;
        this._dashMax    = 4 + Math.floor(Math.random() * 3);
      }
    }
  }

  _spawnAfterimage() {
    const mat = new THREE.SpriteMaterial({
      map:         TEXTURES[this.type],
      transparent: true,
      opacity:     0.55,
      color:       new THREE.Color(0x22aaff),
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(this.def.width, this.def.height, 1);
    s.position.copy(this.sprite.position);
    this.scene.add(s);
    this._afterimages.push({ sprite: s, life: 0.22, maxLife: 0.22 });
  }

  _updateAfterimages(dt) {
    for (let i = this._afterimages.length - 1; i >= 0; i--) {
      const g = this._afterimages[i];
      g.life -= dt;
      g.sprite.material.opacity = Math.max(0, (g.life / g.maxLife) * 0.55);
      if (g.life <= 0) {
        this.scene.remove(g.sprite);
        g.sprite.material.dispose();
        this._afterimages.splice(i, 1);
      }
    }
  }

  // ── Damage / Death ───────────────────────────────────────────────────────

  takeDamage(amount) {
    this.hp -= amount;
    this._mat.color.setHex(0xff4444);
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => { if (this._mat) this._mat.color.setHex(0xffffff); }, 80);
    if (this.hp <= 0) this.die();
    else this._updateVisuals();
    return this.alive;
  }

  die() {
    this.alive = false;
    this.scene.remove(this.sprite);
    this.scene.remove(this._hpFg);
    if (this._laserLine) {
      this.scene.remove(this._laserLine);
      this._laserLine.geometry.dispose();
      this._laserLine.material.dispose();
      this._laserLine = null;
    }
    if (this._afterimages) {
      for (const g of this._afterimages) {
        this.scene.remove(g.sprite);
        g.sprite.material.dispose();
      }
      this._afterimages = [];
    }
    this._mat.dispose();
    this._hpFg.material.dispose();
    if (this.onDeath) this.onDeath(this.pos.clone(), this.type);
  }

  applyKnockback(nx, nz, force) {
    this._kbVelX  = nx * force;
    this._kbVelZ  = nz * force;
    this._kbTimer = 0.3;
  }

  _updateVisuals() {
    const cy = this.pos.y + this.hbH / 2;
    this.sprite.position.set(this.pos.x, cy, this.pos.z);

    const barY = this.pos.y + this.hbH + 0.2;
    const pct  = Math.max(0, this.hp / this.maxHp);
    const barW = this.def.width * 0.9;
    this._hpFg.scale.set(barW * pct, 0.09, 1);
    this._hpFg.position.set(this.pos.x - barW * (1 - pct) / 2, barY, this.pos.z);
  }
}

// ── WaveManager ──────────────────────────────────────────────────────────────

export class WaveManager {
  constructor(scene, spawnPoints, bounds, collision) {
    this.scene       = scene;
    this.spawnPoints = spawnPoints;
    this.bounds      = bounds;
    this.collision   = collision;
    this.enemies     = [];
    this.wave        = 0;
    this._queue      = [];
    this._spawnTimer = 0;
    this.SPAWN_INTERVAL  = 0.7;
    this.onEnemyDeath    = null; // fn(pos, type)
    this.onSpecialAttack = null; // fn(enemy, data)
    this._bossPool       = ['boss_rocketeer', 'boss_charger', 'boss_dasher'];
    this._bossUsed       = new Set();
    this.pendingBossType = null;
  }

  _pickBossType() {
    if (this._bossUsed.size >= this._bossPool.length) this._bossUsed.clear();
    const available = this._bossPool.filter(t => !this._bossUsed.has(t));
    const chosen    = available[Math.floor(Math.random() * available.length)];
    this._bossUsed.add(chosen);
    return chosen;
  }

  startWave() {
    this.wave++;
    const isBossWave = this.wave % 5 === 0;
    this.pendingBossType = isBossWave ? this._pickBossType() : null;
    this._queue      = this._buildQueue(this.wave);
    this._spawnTimer = 0;
  }

  _buildQueue(wave) {
    if (wave % 5 === 0) {
      const q = [this.pendingBossType ?? 'boss'];
      const escorts = ['soldier','molotov','trishot','ranged','drone_gun','drone_bomb','guerrilla'];
      for (let i = 0; i < wave; i++) q.push(escorts[i % escorts.length]);
      return q;
    }

    const total = 4 + wave * 3;
    const q = [];
    for (let i = 0; i < total; i++) {
      let pool;
      if      (wave < 3)  pool = ['soldier'];
      else if (wave < 5)  pool = ['soldier','soldier','rusher','molotov','drone_bomb'];
      else if (wave < 7)  pool = ['soldier','rusher','ranged','molotov','trishot','drone_bomb','sniper','drone_gun'];
      else if (wave < 10) pool = ['soldier','rusher','ranged','molotov','trishot','drone_bomb','sniper','drone_gun','guerrilla'];
      else                pool = ['soldier','rusher','ranged','molotov','trishot','drone_bomb','sniper','drone_gun','guerrilla','tank'];
      q.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return q;
  }

  update(dt, playerPos, onAttackPlayer, onFireProjectile) {
    // Trickle spawn
    if (this._queue.length > 0) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        const type = this._queue.shift();
        const sp   = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
        const jitter = () => (Math.random() - 0.5) * 4;
        const e = new Enemy(type, sp.x + jitter(), sp.z + jitter(), this.scene, this.collision);
        // Scale boss HP with wave number
        if (e.def.isBossType) {
          const bossWaveN = Math.floor(this.wave / 5); // 1 at wave5, 2 at wave10…
          const mult = bossWaveN * 0.6 + 0.4;         // 1.0× at wave5, 1.6× at wave10…
          e.hp = e.maxHp = Math.round(e.def.hp * mult);
        }
        if (this.onEnemyDeath)    e.onDeath         = this.onEnemyDeath;
        if (this.onSpecialAttack) e.onSpecialAttack = this.onSpecialAttack;
        this.enemies.push(e);
        this._spawnTimer = this.SPAWN_INTERVAL;
      }
    }

    // Update alive enemies
    const alive = this.enemies.filter(e => e.alive);
    for (const e of alive) {
      e.update(dt, playerPos, onAttackPlayer, onFireProjectile, alive, this.bounds);
    }

    // Prune dead
    this.enemies = alive;
  }

  get allDead()    { return this._queue.length === 0 && this.enemies.length === 0; }
  get aliveCount() { return this.enemies.length; }

  dispose() {
    this.enemies.forEach(e => { if (e.alive) e.die(); });
    this.enemies = [];
    this._queue  = [];
  }
}
