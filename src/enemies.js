// enemies.js — Enemy class + WaveManager
// Phase 3 Enemy AI extracted here so main.js stays clean.

import * as THREE from 'three';
import { makeEnemyTexture, makeBossTexture } from './utils/PlaceholderTextures.js';

const TEXTURES = {
  soldier: makeEnemyTexture('soldier'),
  rusher:  makeEnemyTexture('rusher'),
  ranged:  makeEnemyTexture('ranged'),
  boss:    makeBossTexture(),
};

export const ENEMY_DEFS = {
  soldier: { hp: 80,  speed: 3.5, damage: 10, attackRate: 1.2, attackRange: 1.6,
             width: 1.0, height: 1.8, hbHalfW: 0.4, score: 100 },
  rusher:  { hp: 45,  speed: 6.5, damage: 18, attackRate: 0.8, attackRange: 1.4,
             width: 0.9, height: 1.6, hbHalfW: 0.35, score: 150 },
  ranged:  { hp: 55,  speed: 2.8, damage: 8,  attackRate: 2.0, attackRange: 18,
             width: 1.0, height: 1.8, hbHalfW: 0.4, score: 120,
             projectile: true, preferDist: 10 },
  boss:    { hp: 500, speed: 3.0, damage: 25, attackRate: 1.0, attackRange: 2.2,
             width: 2.0, height: 2.8, hbHalfW: 0.8, score: 1000 },
};

export class Enemy {
  constructor(type, x, z, scene, collision) {
    this.type      = type;
    this.def       = ENEMY_DEFS[type];
    this.hp        = this.def.hp;
    this.maxHp     = this.def.hp;
    this.alive     = true;
    this.scene     = scene;
    this.collision = collision; // may be null if not provided

    this.pos      = new THREE.Vector3(x, 0, z);
    this.velocity = new THREE.Vector3();

    this.hbHalfW = this.def.hbHalfW;
    this.hbH     = this.def.height;

    this.attackCooldown = Math.random() * this.def.attackRate;
    this._strafeSign    = Math.random() < 0.5 ? 1 : -1;
    this._strafeTimer   = 0;
    this._steerCooldown = 0; // steering probe cooldown
    this.onDeath  = null;   // optional fn(pos, type) fired when enemy dies
    this._kbVelX  = 0;      // knockback velocity
    this._kbVelZ  = 0;
    this._kbTimer = 0;      // seconds remaining on knockback

    // Sprite
    const mat = new THREE.SpriteMaterial({
      map: TEXTURES[type], transparent: true, alphaTest: 0.1,
    });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(this.def.width, this.def.height, 1);
    this._mat = mat;
    scene.add(this.sprite);

    // HP bar
    const bgMat = new THREE.SpriteMaterial({ color: 0x550000 });
    this._hpBg  = new THREE.Sprite(bgMat);
    this._hpBg.scale.set(this.def.width * 0.9, 0.09, 1);
    scene.add(this._hpBg);

    const fgMat = new THREE.SpriteMaterial({ color: 0x00dd44 });
    this._hpFg  = new THREE.Sprite(fgMat);
    scene.add(this._hpFg);

    this._updateVisuals();
  }

  // Ray vs AABB — used by shooting system
  rayIntersect(origin, dir) {
    const minX = this.pos.x - this.hbHalfW;
    const maxX = this.pos.x + this.hbHalfW;
    const minY = this.pos.y;
    const maxY = this.pos.y + this.hbH;
    const minZ = this.pos.z - this.hbHalfW;
    const maxZ = this.pos.z + this.hbHalfW;

    let tmin = -Infinity, tmax = Infinity;
    for (const [o, d, lo, hi] of [
      [origin.x, dir.x, minX, maxX],
      [origin.y, dir.y, minY, maxY],
      [origin.z, dir.z, minZ, maxZ],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (o < lo || o > hi) return Infinity;
      } else {
        const t1 = (lo - o) / d;
        const t2 = (hi - o) / d;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
    }
    if (tmax < 0 || tmin > tmax) return Infinity;
    return tmin < 0 ? tmax : tmin;
  }

  update(dt, playerPos, onAttackPlayer, onFireProjectile, allEnemies, bounds) {
    if (!this.alive) return;

    this.attackCooldown -= dt;

    const dx   = playerPos.x - this.pos.x;
    const dz   = playerPos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const nx   = dist > 0.01 ? dx / dist : 0;
    const nz   = dist > 0.01 ? dz / dist : 0;

    if (this.def.projectile) {
      // Ranged: strafe and keep preferred distance
      const tooClose = dist < this.def.preferDist - 2;
      const tooFar   = dist > this.def.preferDist + 2;

      this._strafeTimer -= dt;
      if (this._strafeTimer <= 0) {
        this._strafeSign  = -this._strafeSign;
        this._strafeTimer = 1.5 + Math.random();
      }

      const strafeX = -nz * this._strafeSign;
      const strafeZ =  nx * this._strafeSign;

      if (tooClose) {
        this.velocity.set(-nx * this.def.speed, 0, -nz * this.def.speed);
      } else if (tooFar) {
        this.velocity.set(nx * this.def.speed * 0.7, 0, nz * this.def.speed * 0.7);
      } else {
        this.velocity.set(strafeX * this.def.speed * 0.5, 0, strafeZ * this.def.speed * 0.5);
      }

      // Shoot
      if (this.attackCooldown <= 0 && dist < this.def.attackRange) {
        this.attackCooldown = this.def.attackRate;
        if (onFireProjectile) onFireProjectile(this);
      }

    } else {
      // Melee: chase
      this.velocity.set(nx * this.def.speed, 0, nz * this.def.speed);

      if (dist < this.def.attackRange && this.attackCooldown <= 0) {
        this.attackCooldown = this.def.attackRate;
        onAttackPlayer(this.def.damage);
        // Bounce self away from player so enemies don't stack on the player
        this.applyKnockback(-nx, -nz, 12);
      }
    }

    // ── Wall steering (Option B) ──────────────────────────────────────────────
    // Every few frames probe ahead; if blocked, deflect left or right.
    if (this.collision && this.velocity.lengthSq() > 0.01) {
      this._steerCooldown -= dt;
      if (this._steerCooldown <= 0) {
        this._steerCooldown = 0.12; // probe ~8 times/sec

        const PROBE_DIST = 1.2;
        const moveDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize();
        const probeOrigin = new THREE.Vector3(this.pos.x, 0.9, this.pos.z);
        const frontDist = this.collision.raycast(probeOrigin, moveDir, PROBE_DIST);

        if (frontDist < PROBE_DIST) {
          // Blocked — probe 45° left and 45° right, pick the clearer side
          const leftDir  = new THREE.Vector3(-moveDir.z, 0,  moveDir.x);
          const rightDir = new THREE.Vector3( moveDir.z, 0, -moveDir.x);
          const leftDist  = this.collision.raycast(probeOrigin, leftDir,  PROBE_DIST);
          const rightDist = this.collision.raycast(probeOrigin, rightDir, PROBE_DIST);

          const blendDir = leftDist >= rightDist ? leftDir : rightDir;
          // Blend: 50% original + 50% deflection
          const newDir = moveDir.clone().multiplyScalar(0.3).addScaledVector(blendDir, 0.7).normalize();
          const speed  = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
          this.velocity.set(newDir.x * speed, 0, newDir.z * speed);
        }
      }
    }

    // ── Integrate ────────────────────────────────────────────────────────────
    let kbX = 0, kbZ = 0;
    if (this._kbTimer > 0) {
      const frac = this._kbTimer / 0.3; // 1→0 over 0.3s
      kbX = this._kbVelX * frac * dt;
      kbZ = this._kbVelZ * frac * dt;
      this._kbTimer -= dt;
      if (this._kbTimer < 0) this._kbTimer = 0;
    }
    const nextX = this.pos.x + this.velocity.x * dt + kbX;
    const nextZ = this.pos.z + this.velocity.z * dt + kbZ;

    // Per-axis wall slide: try X then Z independently
    if (this.collision) {
      const testXZ = this.collision.resolve(
        new THREE.Vector3(nextX, 0, nextZ), this.hbHalfW, this.hbH
      );
      this.pos.x = testXZ.x;
      this.pos.z = testXZ.z;
      // Keep y=0 (enemies walk on floor only)
    } else {
      this.pos.x = nextX;
      this.pos.z = nextZ;
    }

    // Bounds clamp (last resort, should rarely trigger now)
    this.pos.x = Math.max(bounds.minX + this.hbHalfW, Math.min(bounds.maxX - this.hbHalfW, this.pos.x));
    this.pos.z = Math.max(bounds.minZ + this.hbHalfW, Math.min(bounds.maxZ - this.hbHalfW, this.pos.z));

    // Separate from other enemies
    for (const other of allEnemies) {
      if (other === this || !other.alive) continue;
      const ex = this.pos.x - other.pos.x;
      const ez = this.pos.z - other.pos.z;
      const d2 = ex * ex + ez * ez;
      const minD = this.hbHalfW + other.hbHalfW + 0.05;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d    = Math.sqrt(d2);
        const push = (minD - d) * 0.5;
        this.pos.x += (ex / d) * push;
        this.pos.z += (ez / d) * push;
      }
    }

    this._updateVisuals();
  }

  takeDamage(amount) {
    this.hp -= amount;
    this._mat.color.setHex(0xff4444);
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this._mat.color.setHex(0xffffff), 80);
    if (this.hp <= 0) this.die();
    else this._updateVisuals();
    return this.alive;
  }

  die() {
    this.alive = false;
    this.scene.remove(this.sprite);
    this.scene.remove(this._hpBg);
    this.scene.remove(this._hpFg);
    this._mat.dispose();
    this._hpBg.material.dispose();
    this._hpFg.material.dispose();
    if (this.onDeath) this.onDeath(this.pos.clone(), this.type);
  }

  applyKnockback(nx, nz, force) {
    this._kbVelX  = nx * force;
    this._kbVelZ  = nz * force;
    this._kbTimer = 0.3;
  }

  _updateVisuals() {
    const cy   = this.pos.y + this.hbH / 2;
    this.sprite.position.set(this.pos.x, cy, this.pos.z);

    const barY = this.pos.y + this.hbH + 0.2;
    const pct  = Math.max(0, this.hp / this.maxHp);
    const barW = this.def.width * 0.9;
    this._hpBg.position.set(this.pos.x, barY, this.pos.z);
    this._hpFg.scale.set(barW * pct, 0.09, 1);
    this._hpFg.position.set(this.pos.x - barW * (1 - pct) / 2, barY, this.pos.z);
  }
}

// ── WaveManager ───────────────────────────────────────────────────────────────

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
    this.SPAWN_INTERVAL = 0.7;
    this.onEnemyDeath   = null; // fn(pos, type) — set by caller to trigger drops
  }

  startWave() {
    this.wave++;
    this._queue = this._buildQueue(this.wave);
    this._spawnTimer = 0;
  }

  _buildQueue(wave) {
    if (wave % 5 === 0) {
      // Boss wave
      const q = ['boss'];
      for (let i = 0; i < wave; i++) q.push('soldier');
      return q;
    }
    const total = 4 + wave * 3;
    const q = [];
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (wave < 3) {
        q.push('soldier');
      } else if (wave < 5) {
        q.push(r < 0.5 ? 'soldier' : r < 0.8 ? 'rusher' : 'ranged');
      } else {
        q.push(r < 0.3 ? 'soldier' : r < 0.6 ? 'rusher' : 'ranged');
      }
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
        if (this.onEnemyDeath) e.onDeath = this.onEnemyDeath;
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

  get allDead() {
    return this._queue.length === 0 && this.enemies.length === 0;
  }

  get aliveCount() { return this.enemies.length; }

  dispose() {
    this.enemies.forEach(e => { if (e.alive) e.die(); });
    this.enemies = [];
    this._queue  = [];
  }
}
