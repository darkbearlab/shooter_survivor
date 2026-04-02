// ResourceNodes — fixed supply caches that periodically spawn drops.
//
// Four nodes at arena corners. Each has a RESPAWN_TIME cooldown.
// After cooldown, calls onSpawn(position) so main.js decides what to drop.
// Visual: small pulsing ground sprite — dim gray while cooling, bright green when ready.

import * as THREE from 'three';

const RESPAWN_TIME = 120; // seconds

// ── Node sprite texture ───────────────────────────────────────────────────────

function makeNodeTex(ready) {
  const S = 24;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const H = S / 2;

  // Diamond shape
  ctx.fillStyle = ready ? 'rgba(100,220,80,0.9)' : 'rgba(60,60,60,0.7)';
  ctx.beginPath();
  ctx.moveTo(H,      2);
  ctx.lineTo(S - 2,  H);
  ctx.lineTo(H,      S - 2);
  ctx.lineTo(2,      H);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = ready ? '#88ff44' : '#444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner dot
  ctx.fillStyle = ready ? '#ffffff' : '#555';
  ctx.beginPath();
  ctx.arc(H, H, 2.5, 0, Math.PI * 2);
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

const TEX_READY = makeNodeTex(true);
const TEX_COOL  = makeNodeTex(false);

// ── ResourceNodes ─────────────────────────────────────────────────────────────

export class ResourceNodes {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3[]} positions  — fixed world positions for each node
   * @param {function(THREE.Vector3): void} onSpawn  — called when a node fires
   */
  constructor(scene, positions, onSpawn) {
    this.scene   = scene;
    this.onSpawn = onSpawn;
    this._time   = 0;

    // Stagger initial timers so nodes don't all fire at once
    this._nodes = positions.map((pos, i) => {
      const mat    = new THREE.SpriteMaterial({ map: TEX_COOL, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.55, 0.55, 1);
      sprite.position.set(pos.x, 0.05, pos.z); // flat on the floor
      scene.add(sprite);

      return {
        pos:    pos.clone(),
        sprite,
        timer:  RESPAWN_TIME * (0.3 + i * 0.18), // staggered initial delays
        ready:  false,
      };
    });
  }

  update(dt) {
    this._time += dt;

    for (const n of this._nodes) {
      if (n.ready) {
        // Pulse while waiting to be collected
        const pulse = 0.7 + Math.sin(this._time * 4) * 0.3;
        n.sprite.material.opacity = pulse;
        continue;
      }

      n.timer -= dt;

      if (n.timer <= 0) {
        // Spawn drop and reset
        n.ready = false;
        n.timer = RESPAWN_TIME;
        n.sprite.material.map = TEX_COOL;
        n.sprite.material.opacity = 0.7;
        n.sprite.material.needsUpdate = true;
        if (this.onSpawn) this.onSpawn(n.pos.clone());
      } else {
        // Show cooldown progress: fade toward bright as timer approaches 0
        const progress = 1 - n.timer / RESPAWN_TIME;
        n.sprite.material.opacity = 0.25 + progress * 0.45;
        // Switch to ready texture in the last 10% of cooldown for a "priming" look
        const wantsReady = progress > 0.9;
        if (wantsReady && n.sprite.material.map !== TEX_READY) {
          n.sprite.material.map = TEX_READY;
          n.sprite.material.needsUpdate = true;
        } else if (!wantsReady && n.sprite.material.map !== TEX_COOL) {
          n.sprite.material.map = TEX_COOL;
          n.sprite.material.needsUpdate = true;
        }
      }
    }
  }

  dispose() {
    for (const n of this._nodes) {
      this.scene.remove(n.sprite);
      n.sprite.material.dispose();
    }
    this._nodes = [];
  }
}
