// =============================================================================
// main.js — Phase 5 (partial): Character Select + Rocket Launcher
// =============================================================================

import * as THREE from 'three';
import { Player }            from './player.js';
import { CollisionSystem }   from './systems/CollisionSystem.js';
import { ProjectileSystem }  from './systems/ProjectileSystem.js';
import { DropSystem }        from './systems/DropSystem.js';
import { GrenadeSystem }     from './systems/GrenadeSystem.js';
import { ResourceNodes }     from './systems/ResourceNodes.js';
import { WEAPON_DEFS }       from './weapons.js';
import { FixedArena }        from './level/FixedArena.js';
import { getCharacter }      from './characters.js';
import { WaveManager }       from './enemies.js';
import { UpgradeMenu }       from './ui/UpgradeMenu.js';
import { HUD }               from './ui/HUD.js';
import { CharacterSelect }   from './ui/CharacterSelect.js';
import { BalanceMenu }       from './ui/BalanceMenu.js';
import { DebugMenu }         from './ui/DebugMenu.js';

// ── Renderer ──────────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111118);

const scene = new THREE.Scene();
scene.fog   = new THREE.Fog(0x111118, 20, 55);

const camera = new THREE.PerspectiveCamera(105, window.innerWidth / window.innerHeight, 0.1, 100);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Game globals (set in startGame) ──────────────────────────────────────────

let player       = null;
let waveManager  = null;
let projSystem   = null;
let dropSystem     = null;
let grenadeSystem  = null;
let resourceNodes  = null;
let collision      = null;
let hud          = null;
let upgradeMenu  = null;
let balanceMenu  = null;
let debugMenu    = null;
let gameState    = 'char_select'; // 'char_select' | 'playing' | 'upgrading' | 'between_waves' | 'dead'
let paused       = false;
let waveCheckCooldown = 0;
let lastTime     = 0;
let loopStarted  = false;

// ── Pointer Lock ──────────────────────────────────────────────────────────────

const lockPrompt = document.getElementById('lock-prompt');

canvas.addEventListener('click', () => {
  if (gameState === 'playing' && !paused) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  lockPrompt.classList.toggle('hidden', !!document.pointerLockElement || paused || gameState !== 'playing');
});

// ── Balance / Debug menus ─────────────────────────────────────────────────────

function openOverlayMenu(menu) {
  if (paused || gameState !== 'playing') return;
  paused = true;
  document.exitPointerLock();
  menu.show(() => {
    paused = false;
    if (gameState === 'playing') canvas.requestPointerLock();
  });
}

document.addEventListener('keydown', e => {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (balanceMenu?._el.classList.contains('hidden')) openOverlayMenu(balanceMenu);
    else balanceMenu?.hide();
  }
  if (e.key === '`') {
    if (debugMenu?._el.classList.contains('hidden')) openOverlayMenu(debugMenu);
    else debugMenu?.hide();
  }
});

// ── Enemy Outlines ────────────────────────────────────────────────────────────

const outlineContainer = document.createElement('div');
outlineContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15;overflow:hidden;';
document.body.appendChild(outlineContainer);

const _wp  = new THREE.Vector3();
const _prj = new THREE.Vector3();

function updateEnemyOutlines() {
  if (!waveManager) return;
  const alive = waveManager.enemies;

  while (outlineContainer.children.length < alive.length) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;border:2px solid;pointer-events:none;box-sizing:border-box;';
    outlineContainer.appendChild(el);
  }
  for (let i = 0; i < outlineContainer.children.length; i++) {
    outlineContainer.children[i].style.display = i < alive.length ? 'block' : 'none';
  }

  const W = window.innerWidth, H = window.innerHeight;
  const tanHFov = Math.tan(camera.fov * Math.PI / 360);

  alive.forEach((e, i) => {
    const el = outlineContainer.children[i];
    _wp.set(e.pos.x, e.pos.y + e.hbH * 0.5, e.pos.z);
    _prj.copy(_wp).project(camera);

    if (_prj.z > 1) { el.style.display = 'none'; return; }

    const sx  = ( _prj.x * 0.5 + 0.5) * W;
    const sy  = (-_prj.y * 0.5 + 0.5) * H;
    const d   = camera.position.distanceTo(_wp);
    const pxH = Math.max(20, Math.min(220, (e.hbH / d) * (H / (2 * tanHFov))));
    const pxW = pxH * 0.5;
    const cx  = Math.max(2, Math.min(W - pxW - 2, sx - pxW / 2));
    const cy  = Math.max(2, Math.min(H - pxH - 2, sy - pxH / 2));

    const pct = e.hp / e.maxHp;
    const r = 255, g = Math.round(pct * 180);
    el.style.borderColor = `rgba(${r},${g},50,0.85)`;
    el.style.boxShadow   = `0 0 6px rgba(${r},${g},50,0.5)`;
    el.style.left = cx + 'px'; el.style.top  = cy + 'px';
    el.style.width = pxW + 'px'; el.style.height = pxH + 'px';
  });
}

// ── Muzzle Flash ──────────────────────────────────────────────────────────────

const muzzleCanvas = document.createElement('canvas');
muzzleCanvas.width = muzzleCanvas.height = 16;
const mctx = muzzleCanvas.getContext('2d');
const mg   = mctx.createRadialGradient(8, 8, 0, 8, 8, 8);
mg.addColorStop(0, 'rgba(255,220,100,1)'); mg.addColorStop(0.4, 'rgba(255,120,0,0.8)'); mg.addColorStop(1, 'rgba(255,80,0,0)');
mctx.fillStyle = mg; mctx.fillRect(0, 0, 16, 16);
const muzzleTex     = new THREE.CanvasTexture(muzzleCanvas);
muzzleTex.magFilter = THREE.NearestFilter;
const muzzleMat     = new THREE.SpriteMaterial({ map: muzzleTex, transparent: true, depthTest: false });
const muzzleSprite  = new THREE.Sprite(muzzleMat);
muzzleSprite.scale.set(0.5, 0.5, 1);
muzzleSprite.visible = false;
scene.add(muzzleSprite);
let muzzleTimer = 0;

function updateMuzzle(dt) {
  if (muzzleTimer <= 0) return;
  muzzleTimer -= dt;
  if (muzzleTimer <= 0) { muzzleSprite.visible = false; return; }
  const off = new THREE.Vector3(0.18, -0.12, -0.35).applyQuaternion(camera.quaternion);
  muzzleSprite.position.copy(camera.position).add(off);
}

function showMuzzleFlash(color) {
  if (color !== undefined) muzzleMat.color.set(color);
  else                     muzzleMat.color.set(0xffffff);
  const off = new THREE.Vector3(0.18, -0.12, -0.35).applyQuaternion(camera.quaternion);
  muzzleSprite.position.copy(camera.position).add(off);
  muzzleSprite.visible = true;
  muzzleTimer = 0.05;
}

// ── Railgun Beam ──────────────────────────────────────────────────────────────
// Short-lived Line objects that fade out after the shot.

const _railBeams = [];

function spawnRailBeam(from, to) {
  const positions = new Float32Array([
    from.x, from.y, from.z,
    to.x,   to.y,   to.z,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat  = new THREE.LineBasicMaterial({ color: 0x44eeff, transparent: true, opacity: 1.0, linewidth: 1 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  _railBeams.push({ line, life: 0.35 });

  // A slightly thicker outer glow (white, short-lived)
  const mat2  = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const geo2  = geo.clone();
  const line2 = new THREE.Line(geo2, mat2);
  scene.add(line2);
  _railBeams.push({ line: line2, life: 0.12 });
}

function updateRailBeams(dt) {
  for (let i = _railBeams.length - 1; i >= 0; i--) {
    const b = _railBeams[i];
    b.life -= dt;
    if (b.life <= 0) {
      scene.remove(b.line);
      b.line.geometry.dispose();
      b.line.material.dispose();
      _railBeams.splice(i, 1);
    } else {
      b.line.material.opacity = b.life / 0.35;
    }
  }
}

// ── Shooting ──────────────────────────────────────────────────────────────────

function handleShooting() {
  if (paused || !document.pointerLockElement || !player.isFiring) return;

  player.tryFire(({ origin, direction }, dmgMult) => {
    const def = player.weapon.def;
    showMuzzleFlash(def.id === 'railgun' ? 0x44eeff : undefined);

    if (def.type === 'melee') {
      // Instant short-range attack — ray vs each enemy AABB, closest within range
      const MELEE_RANGE = def.range ?? 2.2;
      let hit = false;
      for (const e of waveManager.enemies) {
        if (!e.alive) continue;
        const d = e.rayIntersect(origin, direction);
        if (d < MELEE_RANGE) {
          // Ensure no wall between player and target
          const wallDist = collision.raycast(origin, direction, d);
          if (wallDist >= d) {
            const survived = e.takeDamage(def.damage * dmgMult);
            if (!survived) { player.onKill(); hud.showKill(e.type); }
            // Knockback the hit enemy away from player
            const dx = e.pos.x - player.position.x;
            const dz = e.pos.z - player.position.z;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            e.applyKnockback(dx / len, dz / len, 14);
            hit = true;
          }
        }
      }
      if (hit) hud.flashHit();
      return;

    } else if (def.type === 'hitscan' && def.penetrate) {
      // ── Railgun: pierce through all enemies along the ray ─────────────────
      const RANGE   = def.range ?? 200;
      const wallDist = collision.raycast(origin, direction, RANGE);
      const beamEnd  = origin.clone().addScaledVector(direction, Math.min(wallDist, RANGE));

      // Collect all enemies hit along the ray (sorted by distance)
      const hits = [];
      for (const e of waveManager.enemies) {
        if (!e.alive) continue;
        const d = e.rayIntersect(origin, direction);
        if (d < wallDist && d < RANGE) hits.push({ e, d });
      }
      hits.sort((a, b) => a.d - b.d);

      let hitAny = false;
      for (const { e } of hits) {
        const survived = e.takeDamage(def.damage * dmgMult);
        if (!survived) { player.onKill(); hud.showKill(e.type); }
        hitAny = true;
      }

      spawnRailBeam(origin, beamEnd);
      if (hitAny) hud.flashHit();

    } else if (def.type === 'hitscan') {
      const pellets = def.pellets ?? 1;
      const spread  = def.spread  ?? 0;
      let hitEnemy  = false;

      for (let p = 0; p < pellets; p++) {
        const dir = direction.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * spread * 2,
          (Math.random() - 0.5) * spread * 2,
          (Math.random() - 0.5) * spread * 2,
        )).normalize();

        let closestDist  = def.range ?? 100;
        let closestEnemy = null;

        for (const e of waveManager.enemies) {
          if (!e.alive) continue;
          const d = e.rayIntersect(origin, dir);
          if (d < closestDist) { closestDist = d; closestEnemy = e; }
        }

        if (closestEnemy) {
          const wallDist = collision.raycast(origin, dir, closestDist);
          if (wallDist >= closestDist) {
            const survived = closestEnemy.takeDamage(def.damage * dmgMult);
            hitEnemy = true;
            if (!survived) { player.onKill(); hud.showKill(closestEnemy.type); }
          }
        }
      }

      if (hitEnemy) hud.flashHit();

    } else if (def.type === 'projectile') {
      // Apply per-weapon spread to the direction
      const spread = def.spread ?? 0;
      const dir = spread > 0
        ? direction.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2,
          )).normalize()
        : direction.clone();

      const spawnCfg = {
        owner:        'player',
        origin:       origin.clone(),
        direction:    dir,
        speed:        def.speed         ?? 14,
        damage:       def.damage        * dmgMult,
        splashRadius: def.splashRadius  ?? 0,
        splashDamage: (def.splashDamage ?? 0) * dmgMult,
        color:        def.projectileColor  ?? '#ff8800',
        scaleX:       def.projectileScaleX ?? 0.35,
        scaleY:       def.projectileScaleY ?? 0.35,
        minTravel:    def.minTravel        ?? 1.8,
      };

      if ((def.splashRadius ?? 0) > 0) {
        // Splash weapon (rocket, etc.) — area damage + self damage
        spawnCfg.onSplash = (pos, radius, splashDmg) => {
          for (const e of waveManager.enemies) {
            if (!e.alive) continue;
            const centre = new THREE.Vector3(e.pos.x, e.pos.y + e.hbH * 0.5, e.pos.z);
            const d = pos.distanceTo(centre);
            if (d < radius) {
              const falloff  = 1 - d / radius;
              const survived = e.takeDamage(splashDmg * falloff);
              if (!survived) { player.onKill(); hud.showKill(e.type); }
              hud.flashHit();
            }
          }
          const selfDist = pos.distanceTo(camera.position);
          const SELF_DMG_MIN_DIST = 2.5;
          if (selfDist >= SELF_DMG_MIN_DIST && selfDist < radius) {
            player.takeDamage(splashDmg * (1 - selfDist / radius) * 0.4);
            hud.flashDamage();
          }
        };
      } else {
        // Direct-hit weapon (nail gun, etc.) — single target damage on contact
        spawnCfg.onHit = (hitPos, hitEnemy) => {
          if (hitEnemy) {
            const survived = hitEnemy.takeDamage(def.damage * dmgMult);
            if (!survived) { player.onKill(); hud.showKill(hitEnemy.type); }
            hud.flashHit();
          }
        };
      }

      projSystem.spawn(spawnCfg);
    }
  });
}

// ── Active Skill (F key) ──────────────────────────────────────────────────────

function handleSkill() {
  // Consume key press even when locked/paused so it doesn't fire on resume
  if (paused || !document.pointerLockElement) {
    if (player) player._wantsSkill = false;
    return;
  }

  const skill = player.tryUseSkill();
  if (!skill) return;

  if (skill.skillId === 'grenade') {
    const aimDir = skill.aimRay.direction;
    const vel = aimDir.clone().multiplyScalar(15);
    vel.y += 6; // upward arc component

    // Spawn slightly in front of eye so it doesn't clip into geometry behind
    const origin = skill.aimRay.origin.clone().addScaledVector(aimDir, 0.7);

    grenadeSystem.throw(origin, vel, {
      damage:      80,
      splashRadius: 5,
      fuseTime:    3.0,
      owner:       'player',
      onExplode(pos, radius, damage) {
        // Damage enemies in radius
        for (const e of waveManager.enemies) {
          if (!e.alive) continue;
          const centre = new THREE.Vector3(e.pos.x, e.pos.y + e.hbH * 0.5, e.pos.z);
          const d = pos.distanceTo(centre);
          if (d < radius) {
            const falloff  = 1 - d / radius;
            const survived = e.takeDamage(damage * falloff * player.damageMultiplier);
            if (!survived) { player.onKill(); hud.showKill(e.type); }
            hud.flashHit();
          }
        }
        // Self damage (same formula as rocket, slightly reduced)
        const selfDist = pos.distanceTo(camera.position);
        if (selfDist < radius) {
          player.takeDamage(damage * (1 - selfDist / radius) * 0.35);
          hud.flashDamage();
        }
      },
    });
  }
}

// ── E-prompt ──────────────────────────────────────────────────────────────────

const ePromptEl   = document.getElementById('e-prompt');
const ePromptText = document.getElementById('e-prompt-text');

function updateEPrompt() {
  if (!dropSystem || !player || gameState !== 'playing') {
    ePromptEl.classList.add('hidden'); return;
  }
  const nearby = dropSystem.nearbyWeaponDrop(player.position);
  if (nearby) {
    const wid   = nearby.cfg.weaponId;
    const wdef  = WEAPON_DEFS[wid];
    const slots = player.weapons.length >= player.MAX_WEAPON_SLOTS;
    const action = slots ? `SWAP ${wdef?.name ?? wid}` : `PICK UP ${wdef?.name ?? wid}`;
    ePromptText.textContent = action;
    ePromptEl.classList.remove('hidden');
  } else {
    ePromptEl.classList.add('hidden');
  }
}

function handlePickupInteract() {
  if (paused || !document.pointerLockElement || gameState !== 'playing') {
    if (player) player._wantsInteract = false;
    return;
  }
  if (!player.tryInteract()) return;

  const nearby = dropSystem.nearbyWeaponDrop(player.position);
  if (!nearby) return;

  const drop      = dropSystem.consumeAt(nearby.index);
  const oldWeaponId = player.pickupWeapon(drop.weaponId);

  if (oldWeaponId) {
    // Slots were full — drop the displaced weapon at player feet
    dropSystem.spawn(player.position.clone(), {
      type: 'weapon', weaponId: oldWeaponId,
    });
  }
}

// ── Drop spawning on enemy death ──────────────────────────────────────────────

const AMMO_AMOUNTS = { shotgun: 16, rocket: 4, railgun: 8 };
const DROP_CHANCE  = { soldier: 0.35, rusher: 0.25, ranged: 0.40, boss: 1.0 };

function onEnemyDeath(pos, enemyType) {
  const isBoss    = enemyType === 'boss';
  const dropCount = isBoss ? 3 : (Math.random() < (DROP_CHANCE[enemyType] ?? 0.3) ? 1 : 0);
  if (!dropCount) return;

  const weaponIds = player.weapons.map(w => w.def.id);

  for (let i = 0; i < dropCount; i++) {
    // Spread boss drops in a ring; single drops land at exact position
    const angle    = (i / Math.max(1, dropCount)) * Math.PI * 2;
    const spread   = dropCount > 1 ? 1.2 : 0;
    const spawnPos = pos.clone().add(new THREE.Vector3(
      Math.cos(angle) * spread, 0, Math.sin(angle) * spread,
    ));

    const r = Math.random();
    if (r < 0.25) {
      dropSystem.spawn(spawnPos, { type: 'health', amount: 20 });
    } else if (r < 0.45) {
      dropSystem.spawn(spawnPos, { type: 'armor', amount: 15 });
    } else {
      const weaponId = weaponIds[Math.floor(Math.random() * weaponIds.length)];
      dropSystem.spawn(spawnPos, { type: 'ammo', weaponId, amount: AMMO_AMOUNTS[weaponId] ?? 12 });
    }
  }
}

// ── Enemy ranged projectile callback ─────────────────────────────────────────

function onEnemyFireProjectile(enemy) {
  const toPlayer = player.position.clone().sub(enemy.pos).normalize();
  // Slight upward angle so projectile arcs toward player's centre of mass
  toPlayer.y += 0.05;

  projSystem.spawn({
    owner:        'enemy',
    origin:       new THREE.Vector3(enemy.pos.x, enemy.pos.y + enemy.hbH * 0.6, enemy.pos.z),
    direction:    toPlayer,
    speed:        11,
    damage:       enemy.def.damage,
    splashRadius: 0,
    splashDamage: 0,
    color:        '#ff2200',
    onSplash:     null,
    minTravel:    0.6, // just enough to clear the enemy's own hitbox
  });
}

// ── Wave Progression ──────────────────────────────────────────────────────────

function checkWaveEnd() {
  if (gameState !== 'playing') return;
  if (!waveManager.allDead)    return;
  if (waveCheckCooldown > 0)   return;

  gameState = 'upgrading';
  paused    = true;
  document.exitPointerLock();

  setTimeout(() => {
    upgradeMenu.show(upgradeId => {
      player.applyUpgrade(upgradeId);
      upgradeMenu.hide();
      paused            = false;
      gameState         = 'between_waves';
      waveCheckCooldown = 1.0;
      canvas.requestPointerLock();

      setTimeout(() => {
        waveManager.startWave();
        const isBoss = waveManager.wave % 5 === 0;
        hud.showWaveAnnouncement(waveManager.wave, isBoss);
        gameState = 'playing';
      }, 1500);
    });
  }, 800);
}

// ── Game Over ─────────────────────────────────────────────────────────────────

function triggerGameOver() {
  if (gameState === 'dead') return;
  gameState = 'dead';
  paused    = true;
  document.exitPointerLock();
  hud.hide();
  document.getElementById('game-over-stats').innerHTML =
    `<strong>Wave Reached:</strong> ${waveManager.wave}<br>` +
    `<strong>Total Kills:</strong> ${player.totalKills}<br>` +
    `<strong>Score:</strong> ${player.score}`;
  document.getElementById('game-over').classList.remove('hidden');
}

document.getElementById('restart-btn').addEventListener('click', () => location.reload());

// ── Debug ─────────────────────────────────────────────────────────────────────

const debugEl = document.getElementById('debug-overlay');
function updateDebug() {
  const p = player.position;
  const w = player.weapon;
  debugEl.textContent =
    `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}  ` +
    `spd ${Math.hypot(player.velocity.x, player.velocity.z).toFixed(1)}\n` +
    player.weapons.map((w2, i) => `[${i+1}]${w2.def.name}`).join('  ') + `  active: ${w.def.name}\n` +
    `wave ${waveManager?.wave ?? 0}  enemies ${waveManager?.aliveCount ?? 0}  ` +
    `hp ${player.hp.toFixed(0)}/${player.maxHp}`;
}

// ── Game Loop ─────────────────────────────────────────────────────────────────

function gameLoop(time) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  if (paused || gameState === 'char_select') {
    renderer.render(scene, camera);
    return;
  }

  if (waveCheckCooldown > 0) waveCheckCooldown -= dt;

  player.update(dt);
  handleShooting();
  handleSkill();
  handlePickupInteract();

  waveManager.update(
    dt,
    player.position,
    (dmg) => { player.takeDamage(dmg); hud.flashDamage(); },
    onEnemyFireProjectile,
  );

  // Update projectiles — pass enemies for hit detection, player for enemy projectiles
  projSystem.update(dt, waveManager.enemies, player);
  grenadeSystem.update(dt);
  resourceNodes.update(dt);

  // Pickups
  for (const p of dropSystem.update(dt, player.position)) {
    if (p.type === 'health') {
      player.healHp(p.amount);
    } else if (p.type === 'armor') {
      player.addArmor(p.amount);
    } else if (p.type === 'ammo') {
      const wep = player.weapons.find(w => w.def.id === p.weaponId);
      if (wep) wep.addAmmo(p.amount);
    }
    // 'weapon' type: handled in future phase
    hud.showPickup(p.type, p.amount, p.weaponId);
  }

  // Apply damage from enemy projectiles that hit player (handled inside ProjectileSystem
  // via the hit detection — we need to check and apply here)
  // Actually ProjectileSystem detects the hit but doesn't apply damage directly,
  // so we wire it via a simple proximity check in the update above and call takeDamage via onSplash.
  // For enemy direct-hit projectiles (no splash) we need to handle the hit callback:
  // — this is handled in ProjectileSystem.update() via the owner=='enemy' branch which just
  //   removes the projectile; damage application happens separately below.
  _applyEnemyProjectileHits(dt);

  if (!player.alive) { triggerGameOver(); return; }

  checkWaveEnd();
  hud.update(dt, player.getHUDState(), waveManager.wave);
  updateMuzzle(dt);
  updateRailBeams(dt);
  updateEPrompt();
  updateDebug();

  renderer.render(scene, camera);
  updateEnemyOutlines();
}

// Enemy projectile hit — ProjectileSystem removes the projectile when it hits player,
// but damage needs to be applied here where we have access to player.takeDamage + hud.
function _applyEnemyProjectileHits(_dt) {
  // We wrap onSplash to handle direct hits for enemy projectiles by giving them
  // a minimal splash (radius 0.01) with full damage — see onEnemyFireProjectile above.
  // Actually the cleaner way: pass a per-projectile onHitPlayer callback.
  // For now: ProjectileSystem detects player proximity and calls a registered callback.
  // We'll set this up via a public field.
  if (!projSystem._pendingPlayerHits) return;
  for (const dmg of projSystem._pendingPlayerHits) {
    player.takeDamage(dmg);
    hud.flashDamage();
  }
  projSystem._pendingPlayerHits = [];
}

// ── Start Game ────────────────────────────────────────────────────────────────

function startGame(charId) {
  // Clear scene geometry except lights (rebuild)
  while (scene.children.length > 0) scene.remove(scene.children[0]);

  // Level
  const arena      = new FixedArena();
  const levelGroup = arena.build();
  scene.add(levelGroup);
  collision = new CollisionSystem(arena.getColliders());

  // Player
  const charDef = getCharacter(charId);
  player = new Player(charDef, camera, collision);
  player.position.copy(arena.getPlayerStart());

  // Systems
  projSystem    = new ProjectileSystem(scene, collision);
  grenadeSystem = new GrenadeSystem(scene, collision);
  dropSystem    = new DropSystem(scene);

  // Resource nodes at the 4 arena corners
  const corners = [
    new THREE.Vector3(-22, 0, -22), new THREE.Vector3( 22, 0, -22),
    new THREE.Vector3(-22, 0,  22), new THREE.Vector3( 22, 0,  22),
  ];
  resourceNodes = new ResourceNodes(scene, corners, (pos) => {
    const playerWeaponIds = player.weapons.map(w => w.def.id);
    const r = Math.random();
    if (r < 0.30) {
      dropSystem.spawn(pos, { type: 'health', amount: 30 });
    } else if (r < 0.50) {
      dropSystem.spawn(pos, { type: 'armor', amount: 25 });
    } else if (r < 0.82) {
      // Ammo for a random weapon the player carries
      const wid = playerWeaponIds[Math.floor(Math.random() * playerWeaponIds.length)];
      const AMTS = { shotgun: 20, rocket: 5, railgun: 10, machinegun: 40, nailgun: 20, fists: 0 };
      const amt  = AMTS[wid] ?? 12;
      if (amt > 0) dropSystem.spawn(pos, { type: 'ammo', weaponId: wid, amount: amt });
      else         dropSystem.spawn(pos, { type: 'health', amount: 20 }); // fists → health instead
    } else {
      // Random weapon the player does NOT already have (avoid duplicates)
      const allIds  = Object.keys(WEAPON_DEFS);
      const missing = allIds.filter(id => !playerWeaponIds.includes(id));
      const wid     = missing.length > 0
        ? missing[Math.floor(Math.random() * missing.length)]
        : allIds[Math.floor(Math.random() * allIds.length)];
      dropSystem.spawn(pos, { type: 'weapon', weaponId: wid });
    }
  });
  waveManager = new WaveManager(scene, arena.getSpawnPoints(), arena.getBounds(), collision);
  waveManager.onEnemyDeath = onEnemyDeath;

  // UI
  hud         = new HUD();
  upgradeMenu = new UpgradeMenu();
  // Balance/debug menus are created once and reused across games
  if (!balanceMenu) balanceMenu = new BalanceMenu();
  if (!debugMenu)   debugMenu   = new DebugMenu();
  hud.show();

  // Wire debug menu callbacks to current player/dropSystem
  const CENTER = new THREE.Vector3(0, 0, 0);
  debugMenu.onSpawn    = (cfg) => dropSystem.spawn(CENTER, cfg);
  debugMenu.onFillAmmo = ()    => { for (const w of player.weapons) w.addAmmo(w.def.reserveAmmo ?? 0); };
  debugMenu.onFullHeal = ()    => { player.healHp(player.maxHp); player.addArmor(player.maxArmor); };
  // Sync godMode to current player whenever it's toggled
  const _origToggle = debugMenu._toggleGod.bind(debugMenu);
  debugMenu._toggleGod = () => { _origToggle(); if (player) player.godMode = debugMenu.godMode; };
  player.godMode = debugMenu.godMode;

  document.getElementById('wave-announce').style.display = '';
  document.getElementById('combo-display').style.display = '';
  document.getElementById('kill-feed').style.display     = '';
  document.getElementById('char-select').classList.add('hidden');
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('upgrade-menu').classList.add('hidden');

  // Wire up enemy projectile damage via ProjectileSystem callback
  projSystem._pendingPlayerHits = [];
  projSystem._onEnemyHitPlayer  = (dmg) => projSystem._pendingPlayerHits.push(dmg);

  gameState         = 'between_waves';
  paused            = false;
  waveCheckCooldown = 0;

  setTimeout(() => {
    waveManager.startWave();
    hud.showWaveAnnouncement(waveManager.wave, false);
    gameState = 'playing';
  }, 2000);

  canvas.requestPointerLock();

  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(t => { lastTime = t; requestAnimationFrame(gameLoop); });
  }
}

// ── Boot: show character select ───────────────────────────────────────────────

// Render loop for char select screen (scene is empty but renderer needs to tick)
requestAnimationFrame(function bootLoop(t) {
  if (gameState === 'char_select') {
    requestAnimationFrame(bootLoop);
    renderer.render(scene, camera);
  }
});

const charSelect = new CharacterSelect();
charSelect.show(startGame);
