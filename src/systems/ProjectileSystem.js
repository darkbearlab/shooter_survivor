// ProjectileSystem — generic projectile handling for both player and enemies.
// Spawn a projectile with spawn(config). The same system drives player rockets
// and ranged enemy shots, keeping behavior consistent and allowing players to dodge.

import * as THREE from 'three';

// ── Shared textures ───────────────────────────────────────────────────────────

function makeCircleTex(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 7);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

const TEX = {
  rocket:  makeCircleTex('rgba(255,140,20,1)'),
  enemy:   makeCircleTex('rgba(255,40,40,1)'),
  particle: makeCircleTex('rgba(255,100,0,1)'),
};

// ── ProjectileSystem ──────────────────────────────────────────────────────────

export class ProjectileSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {CollisionSystem} collisionSystem
   */
  constructor(scene, collisionSystem) {
    this.scene     = scene;
    this.collision = collisionSystem;
    this.projectiles = [];
    this.particles   = [];
  }

  /**
   * Spawn a projectile.
   * @param {object} cfg
   *   owner        'player' | 'enemy'   — determines who can be hurt
   *   origin       THREE.Vector3        — start position
   *   direction    THREE.Vector3        — normalised direction
   *   speed        number               — units/s  (rockets: 10, enemy shots: 13)
   *   damage       number               — direct hit damage
   *   splashRadius number               — 0 = no splash
   *   splashDamage number               — damage at splash centre (falloff to 0 at edge)
   *   color        string hex           — projectile tint
   *   onSplash     fn(pos, r, dmg, owner) — called with resolved splash position
   */
  spawn(cfg) {
    const tex = cfg.owner === 'enemy' ? TEX.enemy : TEX.rocket;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      color: new THREE.Color(cfg.color ?? 0xffffff),
      depthTest: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(cfg.scaleX ?? 0.35, cfg.scaleY ?? 0.35, 1);
    sprite.position.copy(cfg.origin);
    this.scene.add(sprite);

    // Trail: a short line behind the projectile
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(6); // 2 points × 3 coords
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(cfg.color ?? 0xffffff),
      transparent: true, opacity: 0.5,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trail);

    this.projectiles.push({
      sprite,
      trail,
      trailPos,
      velocity:     cfg.direction.clone().normalize().multiplyScalar(cfg.speed ?? 12),
      owner:        cfg.owner ?? 'player',
      damage:       cfg.damage ?? 0,
      splashRadius: cfg.splashRadius ?? 0,
      splashDamage: cfg.splashDamage ?? 0,
      onSplash:     cfg.onSplash ?? null,
      onHit:        cfg.onHit    ?? null,
      life:         8,
      traveled:     0,
      minTravel:    cfg.minTravel ?? 1.8,
    });
  }

  /**
   * Update all projectiles.
   * @param {number} dt
   * @param {Enemy[]} enemies   — array of Enemy instances (for hit detection)
   * @param {object}  player    — player object with .position and .takeDamage
   */
  update(dt, enemies, player) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      const prevPos = p.sprite.position.clone();
      const move    = p.velocity.clone().multiplyScalar(dt);
      p.sprite.position.add(move);
      p.traveled   += move.length();

      // Update trail
      const tp = p.trailPos;
      const TRAIL_LEN = 1.0;
      const back = p.velocity.clone().normalize().multiplyScalar(-TRAIL_LEN);
      tp[0] = p.sprite.position.x + back.x;
      tp[1] = p.sprite.position.y + back.y;
      tp[2] = p.sprite.position.z + back.z;
      tp[3] = p.sprite.position.x;
      tp[4] = p.sprite.position.y;
      tp[5] = p.sprite.position.z;
      p.trail.geometry.attributes.position.needsUpdate = true;

      let hit = p.life <= 0;
      let hitPos = p.sprite.position.clone();

      // Skip collision until projectile has traveled minimum distance
      if (!hit && p.traveled >= p.minTravel) {
        // Wall collision
        const dir      = p.velocity.clone().normalize();
        const movelen  = move.length();
        const wallDist = this.collision.raycast(prevPos, dir, movelen + 0.3);
        if (wallDist <= movelen + 0.3) {
          hitPos = prevPos.clone().addScaledVector(dir, wallDist);
          hit    = true;
        }

        // Hit detection vs targets
        if (!hit) {
          if (p.owner === 'player') {
            let hitEnemy = null;
            for (const e of enemies) {
              if (!e.alive) continue;
              // Compare to enemy centre (not feet) so rockets at eye height connect
              const enemyCentre = new THREE.Vector3(e.pos.x, e.pos.y + e.hbH * 0.5, e.pos.z);
              if (p.sprite.position.distanceTo(enemyCentre) < e.hbHalfW + 0.5) {
                hit = true; hitEnemy = e; break;
              }
            }
            if (hit) p._hitEnemy = hitEnemy;
          } else {
            const playerCentre = new THREE.Vector3(player.position.x, player.position.y + 0.9, player.position.z);
            if (player && p.sprite.position.distanceTo(playerCentre) < 0.7) {
              hit = true;
              if (this._onEnemyHitPlayer) this._onEnemyHitPlayer(p.damage);
            }
          }
        }
      }

      if (hit) {
        // Direct hit callback (for non-splash projectiles like nail gun)
        if (p.onHit) p.onHit(hitPos, p._hitEnemy ?? null);
        // Splash
        if (p.splashRadius > 0 && p.onSplash) {
          p.onSplash(hitPos, p.splashRadius, p.splashDamage, p.owner);
        }
        this._explode(hitPos, p.owner === 'enemy' ? '#ff3300' : '#ff8800');
        this._remove(i);
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 10 * dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  _explode(pos, color = '#ff8800') {
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({
        map: TEX.particle, transparent: true, opacity: 1,
        color: new THREE.Color(color),
      });
      const s    = new THREE.Sprite(mat);
      const size = 0.1 + Math.random() * 0.2;
      s.scale.set(size, size, 1);
      s.position.copy(pos);
      this.scene.add(s);
      const vel  = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 10,
      );
      const life = 0.3 + Math.random() * 0.35;
      this.particles.push({ mesh: s, velocity: vel, life, maxLife: life });
    }
  }

  _remove(i) {
    const p = this.projectiles[i];
    this.scene.remove(p.sprite);
    this.scene.remove(p.trail);
    p.sprite.material.dispose();
    p.trail.material.dispose();
    p.trail.geometry.dispose();
    this.projectiles.splice(i, 1);
  }

  dispose() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) this._remove(i);
    this.particles.forEach(p => { this.scene.remove(p.mesh); p.mesh.material.dispose(); });
    this.particles = [];
  }
}
