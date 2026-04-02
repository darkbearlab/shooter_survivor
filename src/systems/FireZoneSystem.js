// FireZoneSystem — persistent ground fire zones created by Molotov enemies.
// Deals tick damage every 0.5s to any player standing inside.

import * as THREE from 'three';

export class FireZoneSystem {
  constructor(scene) {
    this._scene = scene;
    this._zones = [];
  }

  // pos: THREE.Vector3 (snapped to y=0), radius: metres, tickDmg: per 0.5s, duration: seconds
  spawn(pos, radius, tickDmg, duration) {
    // Outer cylinder ring (walls)
    const rGeo = new THREE.CylinderGeometry(radius, radius, 0.5, 20, 1, true);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.position.set(pos.x, 0.25, pos.z);
    this._scene.add(ring);

    // Floor disc
    const dGeo = new THREE.CircleGeometry(radius, 20);
    const dMat = new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(dGeo, dMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pos.x, 0.02, pos.z);
    this._scene.add(disc);

    this._zones.push({
      pos:       pos.clone(),
      radius,
      tickDmg,
      timer:     duration,
      tickTimer: 0,
      ring, rMat, disc, dMat,
    });
  }

  // Returns array of { damage } for every tick that hit the player this frame.
  update(dt, playerPos) {
    const hits = [];
    for (const z of this._zones) {
      z.timer     -= dt;
      z.tickTimer -= dt;

      // Pulse opacity
      const pulse = 0.3 + 0.2 * Math.sin(z.timer * 9);
      z.rMat.opacity = pulse;
      z.dMat.opacity = pulse * 0.75;

      // Tick damage
      if (z.tickTimer <= 0) {
        z.tickTimer = 0.5;
        const dx = playerPos.x - z.pos.x, dz = playerPos.z - z.pos.z;
        if (Math.sqrt(dx * dx + dz * dz) < z.radius) {
          hits.push({ damage: z.tickDmg });
        }
      }

      // Fade out last 1.5s
      if (z.timer < 1.5) {
        const fade = z.timer / 1.5;
        z.rMat.opacity *= fade;
        z.dMat.opacity *= fade;
      }

      if (z.timer <= 0) {
        this._scene.remove(z.ring);
        this._scene.remove(z.disc);
        z.rMat.dispose(); z.ring.geometry.dispose();
        z.dMat.dispose(); z.disc.geometry.dispose();
      }
    }
    this._zones = this._zones.filter(z => z.timer > 0);
    return hits;
  }

  dispose() {
    for (const z of this._zones) {
      this._scene.remove(z.ring);
      this._scene.remove(z.disc);
      z.rMat.dispose(); z.ring.geometry.dispose();
      z.dMat.dispose(); z.disc.geometry.dispose();
    }
    this._zones = [];
  }
}
