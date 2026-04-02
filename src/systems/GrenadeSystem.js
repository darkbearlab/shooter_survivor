// GrenadeSystem — parabolic throwable grenades with wall bounce and timed fuse.
//
// throw(origin, velocity, cfg)
//   cfg: { damage, splashRadius, fuseTime, owner, onExplode(pos, radius, damage, owner) }
//
// update(dt) — physics + fuse + collision.  Damage is delivered via onExplode callback.

import * as THREE from 'three';

const GRAVITY     = 22;     // m/s² — same as player for consistent feel
const BOUNCE_DAMP = 0.45;   // fraction of speed kept after each bounce
const MAX_BOUNCES = 2;
const SPIN_SPEED  = 4;      // radians per second (base)

// ── Textures ──────────────────────────────────────────────────────────────────

function makeGrenadeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');

  // Dark olive body
  ctx.fillStyle = '#3a4a18';
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();

  // Highlight cap
  ctx.fillStyle = '#5a6a28';
  ctx.beginPath();
  ctx.arc(6, 5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Ribbing rings
  ctx.strokeStyle = '#2a3a10';
  ctx.lineWidth = 1;
  for (let r = 2.5; r <= 5.5; r += 1.5) {
    ctx.beginPath();
    ctx.arc(8, 8, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pin (yellow dot at top)
  ctx.fillStyle = '#ddcc22';
  ctx.beginPath();
  ctx.arc(8, 2, 1.5, 0, Math.PI * 2);
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

let _particleTex = null;
function getParticleTex() {
  if (_particleTex) return _particleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 8);
  _particleTex = new THREE.CanvasTexture(c);
  return _particleTex;
}

const GRENADE_TEX = makeGrenadeTex();

// ── GrenadeSystem ─────────────────────────────────────────────────────────────

export class GrenadeSystem {
  /**
   * @param {THREE.Scene}      scene
   * @param {CollisionSystem}  collision
   */
  constructor(scene, collision) {
    this.scene     = scene;
    this.collision = collision;
    this.grenades  = [];
    this.particles = [];
  }

  /**
   * Throw a grenade.
   * @param {THREE.Vector3} origin    — starting world position
   * @param {THREE.Vector3} velocity  — initial velocity (m/s, 3D)
   * @param {object}        cfg
   *   damage:      number
   *   splashRadius: number
   *   fuseTime:    number   — seconds until detonation
   *   owner:       'player' | 'enemy'
   *   onExplode:   fn(pos, radius, damage, owner)  — called at detonation
   */
  throw(origin, velocity, cfg) {
    const mat = new THREE.SpriteMaterial({
      map: GRENADE_TEX, transparent: true, depthTest: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.28, 0.28, 1);
    sprite.position.copy(origin);
    this.scene.add(sprite);

    this.grenades.push({
      sprite,
      pos:       origin.clone(),
      vel:       velocity.clone(),
      fuse:      cfg.fuseTime    ?? 3.0,
      maxFuse:   cfg.fuseTime    ?? 3.0,
      bounces:   0,
      damage:    cfg.damage      ?? 80,
      radius:    cfg.splashRadius ?? 5,
      owner:     cfg.owner       ?? 'player',
      onExplode: cfg.onExplode   ?? null,
      spinRate:  (Math.random() - 0.5) * SPIN_SPEED * 2,
      stuck:     false, // true once it has come to rest
    });
  }

  /** Call every frame. */
  update(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];

      g.fuse -= dt;

      // Flash red in the last 0.8 s
      if (g.fuse < 0.8) {
        const flash = Math.sin(g.fuse * 28) > 0;
        g.sprite.material.color.setHex(flash ? 0xff4400 : 0xffffff);
      }

      if (!g.stuck) {
        const prevPos = g.pos.clone();

        // Gravity
        g.vel.y -= GRAVITY * dt;

        // Proposed position
        const proposed = g.pos.clone().addScaledVector(g.vel, dt);

        // ── Floor collision ───────────────────────────────────────────────────
        const floorY = this.collision.getFloorY(proposed, 0.15);
        const hitFloor = proposed.y <= floorY + 0.14;

        if (hitFloor) {
          if (g.bounces < MAX_BOUNCES && Math.abs(g.vel.y) > 2.5) {
            g.vel.y  = -g.vel.y * BOUNCE_DAMP;
            g.vel.x *= BOUNCE_DAMP;
            g.vel.z *= BOUNCE_DAMP;
            g.bounces++;
          } else {
            g.vel.set(0, 0, 0);
            g.stuck = true;
          }
          proposed.y = floorY + 0.14;
        }

        // ── Wall collision (horizontal only) ─────────────────────────────────
        if (!g.stuck) {
          const hVelSq = g.vel.x * g.vel.x + g.vel.z * g.vel.z;
          if (hVelSq > 0.01) {
            const hDir   = new THREE.Vector3(g.vel.x, 0, g.vel.z).normalize();
            const hMove  = Math.sqrt(hVelSq) * dt;
            const probe  = new THREE.Vector3(prevPos.x, prevPos.y + 0.14, prevPos.z);
            const wDist  = this.collision.raycast(probe, hDir, hMove + 0.25);

            if (wDist <= hMove + 0.25 && g.bounces < MAX_BOUNCES) {
              // Probe X and Z axes to find which wall was hit
              const sx     = Math.sign(g.vel.x) || 1;
              const sz     = Math.sign(g.vel.z) || 1;
              const probeX = this.collision.raycast(probe, new THREE.Vector3(sx, 0, 0), 0.3);
              const probeZ = this.collision.raycast(probe, new THREE.Vector3(0, 0, sz), 0.3);

              // Reflect along the closer axis
              if (probeX <= probeZ) g.vel.x = -g.vel.x * BOUNCE_DAMP;
              else                  g.vel.z = -g.vel.z * BOUNCE_DAMP;

              g.vel.y *= BOUNCE_DAMP;
              g.bounces++;
              proposed.x = prevPos.x;
              proposed.z = prevPos.z;
            }
          }
        }

        g.pos.copy(proposed);
        g.sprite.position.copy(g.pos);

        // Spin while airborne
        if (!g.stuck) g.sprite.material.rotation += g.spinRate * dt;
      }

      // ── Detonate ─────────────────────────────────────────────────────────────
      if (g.fuse <= 0) {
        if (g.onExplode) g.onExplode(g.pos.clone(), g.radius, g.damage, g.owner);
        this._explode(g.pos);
        this._removeGrenade(i);
      }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 10 * dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  _explode(pos) {
    const tex = getParticleTex();
    for (let i = 0; i < 20; i++) {
      const col   = i % 3 === 0 ? '#ffaa22' : i % 3 === 1 ? '#88cc44' : '#ffee88';
      const mat   = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1, color: new THREE.Color(col) });
      const s     = new THREE.Sprite(mat);
      const sz    = 0.12 + Math.random() * 0.24;
      s.scale.set(sz, sz, 1);
      s.position.copy(pos);
      this.scene.add(s);
      const vel  = new THREE.Vector3(
        (Math.random() - 0.5) * 13,
        Math.random() * 9 + 2,
        (Math.random() - 0.5) * 13,
      );
      const life = 0.3 + Math.random() * 0.4;
      this.particles.push({ mesh: s, vel, life, maxLife: life });
    }
  }

  _removeGrenade(i) {
    const g = this.grenades[i];
    this.scene.remove(g.sprite);
    g.sprite.material.dispose();
    this.grenades.splice(i, 1);
  }

  dispose() {
    for (let i = this.grenades.length - 1; i >= 0; i--) this._removeGrenade(i);
    this.particles.forEach(p => { this.scene.remove(p.mesh); p.mesh.material.dispose(); });
    this.particles = [];
  }
}
