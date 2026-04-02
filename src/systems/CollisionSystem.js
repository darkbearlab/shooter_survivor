import * as THREE from 'three';

export class CollisionSystem {
  constructor(colliders) {
    // colliders: Array<{ min: Vector3, max: Vector3 }>
    this.colliders = colliders;
  }

  /**
   * Resolve a capsule (pos = feet position) against all AABB colliders.
   * Tests each axis independently so corner cases don't tunnel.
   * Returns corrected feet position.
   */
  resolve(pos, radius, height) {
    let x = pos.x;
    let y = pos.y;
    let z = pos.z;

    // Run two passes so stacked corrections converge
    for (let pass = 0; pass < 2; pass++) {
      for (const box of this.colliders) {
        // Broad check: does the capsule AABB overlap this box at all?
        if (x + radius <= box.min.x || x - radius >= box.max.x) continue;
        if (y + height  <= box.min.y || y          >= box.max.y) continue;
        if (z + radius <= box.min.z || z - radius >= box.max.z) continue;

        // Penetration on each axis
        const pXpos = (box.max.x + radius) - x;   // push +x
        const pXneg = x - (box.min.x - radius);   // push -x
        const pZpos = (box.max.z + radius) - z;
        const pZneg = z - (box.min.z - radius);
        const pYup  = box.max.y - y;               // push feet up onto surface

        const minPX = Math.min(pXpos, pXneg);
        const minPZ = Math.min(pZpos, pZneg);

        // Step-up threshold: if the box top is within step range, walk onto it
        const STEP_HEIGHT = 0.5;
        if (pYup >= 0 && pYup <= STEP_HEIGHT && minPX > 0.01 && minPZ > 0.01) {
          y = box.max.y;
          continue;
        }

        // Otherwise push out on the least-penetrating horizontal axis
        if (minPX <= minPZ) {
          x += pXpos < pXneg ? pXpos : -pXneg;
        } else {
          z += pZpos < pZneg ? pZpos : -pZneg;
        }
      }
    }

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Find the highest solid surface directly below (or at) the feet position.
   * Returns the Y value the feet should rest on.
   */
  getFloorY(pos, radius) {
    let best = -Infinity;
    const r = radius ?? 0.3;

    for (const box of this.colliders) {
      // Must overlap XZ footprint
      if (pos.x + r <= box.min.x || pos.x - r >= box.max.x) continue;
      if (pos.z + r <= box.min.z || pos.z - r >= box.max.z) continue;
      // Surface must be at or below feet (with small look-ahead so we can land)
      if (box.max.y > pos.y + 0.6) continue;
      if (box.max.y > best) best = box.max.y;
    }

    return best === -Infinity ? 0 : best;
  }

  /**
   * Simple ray vs AABB test. Returns hit distance or Infinity.
   */
  raycast(origin, direction, maxDist = 200) {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const target = new THREE.Vector3();
    let closest = Infinity;

    for (const box of this.colliders) {
      const aabb = new THREE.Box3(box.min, box.max);
      if (ray.intersectBox(aabb, target)) {
        const d = origin.distanceTo(target);
        if (d < closest && d <= maxDist) closest = d;
      }
    }

    return closest;
  }
}
