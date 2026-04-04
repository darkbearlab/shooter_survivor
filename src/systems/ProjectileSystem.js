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

// Ring texture: white ring with soft inner/outer edges — used as billboard shockwave
function makeRingTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const cx = 32, outerR = 31, innerR = 20;
  // Outer soft fade (radial gradient outward)
  const gOut = ctx.createRadialGradient(cx, cx, innerR, cx, cx, outerR);
  gOut.addColorStop(0,   'rgba(255,255,255,0)');
  gOut.addColorStop(0.15,'rgba(255,255,255,1)');
  gOut.addColorStop(0.75,'rgba(255,255,255,1)');
  gOut.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = gOut;
  ctx.beginPath();
  ctx.arc(cx, cx, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cx, innerR, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter;
  return t;
}

const TEX = {
  rocket:   makeCircleTex('rgba(255,140,20,1)'),
  enemy:    makeCircleTex('rgba(255,40,40,1)'),
  particle: makeCircleTex('rgba(255,100,0,1)'),
  ring:     makeRingTex(),
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
    this.shockwaves  = [];
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
        this._explode(hitPos, p.owner === 'enemy' ? '#ff3300' : '#ff8800', p.splashRadius || 0);
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

    // Shockwave billboard rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.t += dt;
      const frac = Math.max(0, Math.min(sw.t / sw.duration, 1));
      const d = frac * sw.radius * 2; // diameter (sprite scale = full width)
      sw.mesh.scale.set(d, d, 1);
      sw.mesh.material.opacity = (1 - frac) * sw.maxOpacity;
      if (frac >= 1) {
        this.scene.remove(sw.mesh);
        sw.mesh.material.dispose(); // texture is shared, don't dispose it
        this.shockwaves.splice(i, 1);
      }
    }
  }

  _explode(pos, color = '#ff8800', radius = 0) {
    const col = new THREE.Color(color);

    // Central flash — large bright sprite that fades fast
    const flashMat = new THREE.SpriteMaterial({
      map: TEX.particle, transparent: true, opacity: 1,
      color: new THREE.Color(color === '#ff3300' ? '#ff9955' : '#ffee88'),
    });
    const flash = new THREE.Sprite(flashMat);
    const flashSz = 0.8 + radius * 0.25;
    flash.scale.set(flashSz, flashSz, 1);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.particles.push({ mesh: flash, velocity: new THREE.Vector3(0, 0.5, 0), life: 0.18, maxLife: 0.18 });

    // Particle burst — more and bigger than before
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({
        map: TEX.particle, transparent: true, opacity: 1,
        color: col,
      });
      const s    = new THREE.Sprite(mat);
      const size = 0.15 + Math.random() * 0.35;
      s.scale.set(size, size, 1);
      s.position.copy(pos);
      this.scene.add(s);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 14,
      );
      const life = 0.35 + Math.random() * 0.4;
      this.particles.push({ mesh: s, velocity: vel, life, maxLife: life });
    }

    // Shockwave — billboard ring sprites, always face the camera
    if (radius > 0.5) {
      const accentCol = new THREE.Color(color === '#ff3300' ? '#ffaa44' : '#ffffff');

      // Primary ring: expands to full radius
      const mat1 = new THREE.SpriteMaterial({
        map: TEX.ring, transparent: true, opacity: 0.80,
        color: col, depthWrite: false,
      });
      const ring1 = new THREE.Sprite(mat1);
      ring1.position.copy(pos);
      ring1.scale.set(0.01, 0.01, 1);
      this.scene.add(ring1);
      this.shockwaves.push({ mesh: ring1, t: 0, duration: 0.38, radius, maxOpacity: 0.80 });

      // Secondary ring: slightly delayed, smaller, brighter accent colour
      const mat2 = new THREE.SpriteMaterial({
        map: TEX.ring, transparent: true, opacity: 0.45,
        color: accentCol, depthWrite: false,
      });
      const ring2 = new THREE.Sprite(mat2);
      ring2.position.copy(pos);
      ring2.scale.set(0.01, 0.01, 1);
      this.scene.add(ring2);
      this.shockwaves.push({ mesh: ring2, t: -0.06, duration: 0.32, radius: radius * 0.80, maxOpacity: 0.45 });
    }
  }

  /**
   * Destroy all enemy projectiles within `radius` of `center`.
   * Spawns a blue pulse visual effect at center.
   * Returns the number of projectiles cleared.
   */
  pulseBlast(center, radius) {
    const r2 = radius * radius;
    let cleared = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.owner !== 'enemy') continue;
      const pp = p.sprite.position;
      // Cylindrical check — XZ only, ignore height difference
      const dx = pp.x - center.x, dz = pp.z - center.z;
      if (dx * dx + dz * dz <= r2) {
        this._remove(i);
        cleared++;
      }
    }
    this._spawnPulse(center, radius);
    return cleared;
  }

  _spawnPulse(pos, radius) {
    // Spawn at eye height so rings are visible in first-person view
    const eyePos = pos.clone();
    eyePos.y += 1.4;

    const blueCol   = new THREE.Color(0x00aaff);
    const brightCol = new THREE.Color(0xaaeeff);

    // ── Large central flash ──────────────────────────────────────────────────
    for (const [col, sz, life] of [
      [brightCol, radius * 0.9, 0.30],   // outer glow
      [blueCol,   radius * 0.5, 0.22],   // inner core
    ]) {
      const mat = new THREE.SpriteMaterial({ map: TEX.particle, transparent: true, opacity: 1, color: col });
      const s   = new THREE.Sprite(mat);
      s.scale.set(sz, sz, 1);
      s.position.copy(eyePos);
      this.scene.add(s);
      this.particles.push({ mesh: s, velocity: new THREE.Vector3(0, 0, 0), life, maxLife: life });
    }

    // ── Particle burst — large outward sparks at multiple heights ────────────
    for (let i = 0; i < 40; i++) {
      const col = i % 3 === 0 ? brightCol : blueCol;
      const mat = new THREE.SpriteMaterial({ map: TEX.particle, transparent: true, opacity: 1, color: col });
      const s   = new THREE.Sprite(mat);
      const sz  = 0.35 + Math.random() * 0.55;
      s.scale.set(sz, sz, 1);
      s.position.copy(eyePos);
      this.scene.add(s);
      const angle = Math.random() * Math.PI * 2;
      const spd   = 10 + Math.random() * 14;
      const vel   = new THREE.Vector3(
        Math.cos(angle) * spd,
        (Math.random() - 0.3) * 8,
        Math.sin(angle) * spd,
      );
      const life = 0.5 + Math.random() * 0.4;
      this.particles.push({ mesh: s, velocity: vel, life, maxLife: life });
    }

    // ── Three concentric rings expanding from eye level ──────────────────────
    const ringData = [
      { delay: 0,     duration: 0.65, maxOpacity: 1.0,  radiusMult: 1.00 },
      { delay: 0,     duration: 0.55, maxOpacity: 0.75, radiusMult: 0.70 },
      { delay: 0,     duration: 0.45, maxOpacity: 0.50, radiusMult: 0.40 },
    ];
    for (const rd of ringData) {
      const mat = new THREE.SpriteMaterial({
        map: TEX.ring, transparent: true, opacity: rd.maxOpacity,
        color: blueCol, depthWrite: false,
      });
      const ring = new THREE.Sprite(mat);
      ring.position.copy(eyePos);
      ring.scale.set(0.01, 0.01, 1);
      this.scene.add(ring);
      this.shockwaves.push({
        mesh: ring, t: rd.delay,
        duration: rd.duration,
        radius: radius * rd.radiusMult,
        maxOpacity: rd.maxOpacity,
      });
    }
  }

  /**
   * Small impact spark at a hitscan hit point.
   * @param {THREE.Vector3} pos
   * @param {string}  color   — weapon hitColor hex string, e.g. '#ff6622'
   * @param {number}  damage  — effective damage dealt; drives visual scale
   */
  _spawnHitSpark(pos, color = '#ff4400', damage = 15) {
    // Scale from damage: 15 dmg → scale 1.0, 120 dmg → scale ~2.2
    const scale = 0.7 + Math.pow(damage / 20, 0.55);

    const mainCol  = new THREE.Color(color);
    const brightCol = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6);

    // Outer glow (weapon colour)
    const matOut = new THREE.SpriteMaterial({ map: TEX.particle, transparent: true, opacity: 1, color: mainCol });
    const outer  = new THREE.Sprite(matOut);
    outer.scale.set(scale * 0.34, scale * 0.34, 1);
    outer.position.copy(pos);
    this.scene.add(outer);
    this.particles.push({ mesh: outer, velocity: new THREE.Vector3(0, 0, 0), life: 0.12, maxLife: 0.12 });

    // Inner bright core
    const matIn = new THREE.SpriteMaterial({ map: TEX.particle, transparent: true, opacity: 1, color: brightCol });
    const inner = new THREE.Sprite(matIn);
    inner.scale.set(scale * 0.14, scale * 0.14, 1);
    inner.position.copy(pos);
    this.scene.add(inner);
    this.particles.push({ mesh: inner, velocity: new THREE.Vector3(0, 0, 0), life: 0.07, maxLife: 0.07 });

    // Tiny outward sparks — more and bigger at higher damage
    const sparkCount = Math.round(3 + damage / 15); // 4 for shotgun pellet, ~10 for railgun
    for (let i = 0; i < sparkCount; i++) {
      const mat = new THREE.SpriteMaterial({ map: TEX.particle, transparent: true, opacity: 1, color: mainCol });
      const s   = new THREE.Sprite(mat);
      const sz  = (0.05 + Math.random() * 0.08) * scale;
      s.scale.set(sz, sz, 1);
      s.position.copy(pos);
      this.scene.add(s);
      const spd = (2 + Math.random() * 4) * scale;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * spd,
        Math.random() * spd * 0.8,
        (Math.random() - 0.5) * spd,
      );
      const life = 0.10 + Math.random() * 0.10;
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
    this.shockwaves.forEach(sw => {
      this.scene.remove(sw.mesh);
      sw.mesh.material.dispose();
    });
    this.shockwaves = [];
  }
}
