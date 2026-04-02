// Preview3D — live Three.js 3D preview of the current EditorState.
// Rebuilds the scene whenever the state changes (via onChange).
// Orbit: left-drag to rotate, right-drag / wheel to zoom.

import * as THREE from 'three';
import { JsonMapBuilder } from '../level/JsonMapBuilder.js';

export class Preview3D {
  constructor(canvas, state) {
    this._canvas   = canvas;
    this._state    = state;
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(0x111118);

    this._scene  = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this._mapGroup = null;

    // Orbit state
    this._orb = { active: false, button: -1, lastX: 0, lastY: 0, theta: -0.5, phi: 0.6, dist: 60 };

    this._bindEvents();
    state.onChange(() => this._rebuild());
    this._rebuild();
    this._loop();
  }

  // ── Scene ─────────────────────────────────────────────────────────────────

  _rebuild() {
    if (this._mapGroup) {
      this._scene.remove(this._mapGroup);
      this._mapGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    }

    const builder = new JsonMapBuilder(this._state.toJSON());
    this._mapGroup = builder.build();
    this._scene.add(this._mapGroup);

    // Spawn / resource / playerStart markers
    this._addMarkers();

    // Only fit camera on first build; after that preserve user's orbit
    if (!this._cameraInitialized) {
      const s = this._state;
      const maxDim = Math.max(s.width, s.depth);
      this._orb.dist = Math.max(30, maxDim * 0.9);
      this._updateCamera();
      this._cameraInitialized = true;
    }
    this.render();
  }

  _addMarkers() {
    const s = this._state;

    // Spawn points — green diamonds
    for (const sp of s.spawnPoints) {
      this._mapGroup.add(this._makeMarker(sp.x, 0.2, sp.z, 0x44ff88, 0.6));
    }

    // Resource nodes — yellow diamonds
    for (const rn of s.resourceNodes) {
      this._mapGroup.add(this._makeMarker(rn.x, 0.2, rn.z, 0xffdd44, 0.6));
    }

    // Player start — red arrow
    if (s.playerStart) {
      this._mapGroup.add(this._makeMarker(s.playerStart.x, 0.2, s.playerStart.z, 0xff4422, 0.8));
    }
  }

  _makeMarker(x, y, z, color, size) {
    const geo = new THREE.ConeGeometry(size * 0.5, size, 4);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 4;
    mesh.position.set(x, y + size * 0.5, z);
    return mesh;
  }

  // ── Camera orbit ──────────────────────────────────────────────────────────

  _updateCamera() {
    const { theta, phi, dist } = this._orb;
    const s = this._state;
    const cx = 0, cy = s.wallHeight / 2, cz = 0; // look-at target
    this._camera.position.set(
      cx + dist * Math.sin(theta) * Math.cos(phi),
      cy + dist * Math.sin(phi),
      cz + dist * Math.cos(theta) * Math.cos(phi),
    );
    this._camera.lookAt(cx, cy, cz);
  }

  _bindEvents() {
    const cv = this._canvas;
    cv.addEventListener('mousedown', e => {
      this._orb.active = true;
      this._orb.button = e.button;
      this._orb.lastX = e.clientX;
      this._orb.lastY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (!this._orb.active) return;
      const dx = e.clientX - this._orb.lastX;
      const dy = e.clientY - this._orb.lastY;
      this._orb.lastX = e.clientX;
      this._orb.lastY = e.clientY;

      if (this._orb.button === 0) { // rotate
        this._orb.theta -= dx * 0.008;
        this._orb.phi    = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, this._orb.phi - dy * 0.008));
      } else if (this._orb.button === 2) { // zoom
        this._orb.dist = Math.max(5, this._orb.dist + dy * 0.3);
      }
      this._updateCamera();
    });
    window.addEventListener('mouseup', () => { this._orb.active = false; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      this._orb.dist = Math.max(5, this._orb.dist + e.deltaY * 0.05);
      this._updateCamera();
    }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  _loop() {
    requestAnimationFrame(() => this._loop());
    this.render();
  }

  render() {
    this._syncSize();
    this._renderer.render(this._scene, this._camera);
  }

  _syncSize() {
    const cv = this._canvas;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (this._renderer.domElement.width  !== w ||
        this._renderer.domElement.height !== h) {
      this._renderer.setSize(w, h, false);
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
  }
}
