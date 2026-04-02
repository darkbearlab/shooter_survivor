// Billboard sprite: always faces the camera (Y-axis only, like Doom/Quake enemies)

import * as THREE from 'three';

export class BillboardSprite {
  constructor(texture, width = 1, height = 1.5) {
    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });
    this.mesh = new THREE.Sprite(this.material);
    this.mesh.scale.set(width, height, 1);
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
  }

  setTexture(texture) {
    this.material.map = texture;
    this.material.needsUpdate = true;
  }

  // Flash white on hit
  flashHit() {
    this.material.color.setHex(0xff4444);
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.material.color.setHex(0xffffff);
    }, 80);
  }

  dispose() {
    this.material.dispose();
  }
}
