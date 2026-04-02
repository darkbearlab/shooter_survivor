// Interface contract for all map implementations.
// FixedArena and future ProceduralMap must implement these methods.

export class IMapBuilder {
  /**
   * Build and return the THREE.Group containing all map geometry.
   * @returns {THREE.Group}
   */
  build() { throw new Error('build() not implemented'); }

  /**
   * Return array of collidable AABB objects: { min: Vector3, max: Vector3 }
   * Used by CollisionSystem.
   * @returns {Array<{min: THREE.Vector3, max: THREE.Vector3}>}
   */
  getColliders() { throw new Error('getColliders() not implemented'); }

  /**
   * Return array of valid enemy spawn positions: THREE.Vector3[]
   */
  getSpawnPoints() { throw new Error('getSpawnPoints() not implemented'); }

  /**
   * Return the player start position: THREE.Vector3
   */
  getPlayerStart() { throw new Error('getPlayerStart() not implemented'); }

  /**
   * Return arena bounds for enemy AI clamping: { minX, maxX, minZ, maxZ }
   */
  getBounds() { throw new Error('getBounds() not implemented'); }
}
