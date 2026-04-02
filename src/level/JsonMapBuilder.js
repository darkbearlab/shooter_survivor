// JsonMapBuilder — loads a map from a plain-object / JSON descriptor.
// Same interface as FixedArena: build() → Group, getColliders(), etc.
// Outer walls, floor, and ceiling are auto-generated from width/depth/wallHeight.
// Custom objects (boxes, pillars, platforms) come from data.objects[].

import * as THREE from 'three';
import { IMapBuilder } from './IMapBuilder.js';
import { makeWallTexture, makeFloorTexture, makeCeilingTexture, makeColumnTexture } from '../utils/PlaceholderTextures.js';

export class JsonMapBuilder extends IMapBuilder {
  constructor(mapData) {
    super();
    this._data      = mapData;
    this._colliders = [];
    this._spawnPoints = [];
    this._group     = new THREE.Group();
  }

  build() {
    const d  = this._data;
    const W  = d.width      ?? 60;
    const D  = d.depth      ?? 60;
    const H  = d.wallHeight ?? 6;
    const hw = W / 2, hd = D / 2;

    // ── Textures ───────────────────────────────────────────────────────────────
    const wallTex  = makeWallTexture();
    const floorTex = makeFloorTexture();
    const ceilTex  = makeCeilingTexture();
    const colTex   = makeColumnTexture();
    [wallTex, floorTex, ceilTex, colTex].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    wallTex.repeat.set(4, 2);
    floorTex.repeat.set(16, 16);
    ceilTex.repeat.set(16, 16);

    const mats = {
      wall:    new THREE.MeshLambertMaterial({ map: wallTex  }),
      floor:   new THREE.MeshLambertMaterial({ map: floorTex }),
      ceiling: new THREE.MeshLambertMaterial({ map: ceilTex  }),
      column:  new THREE.MeshLambertMaterial({ map: colTex   }),
    };

    // ── Auto: floor + ceiling ──────────────────────────────────────────────────
    this._addBox(W, 0.2, D, 0, -0.1,   0, mats.floor);
    this._addBox(W, 0.2, D, 0, H + 0.1, 0, mats.ceiling);

    // ── Auto: outer walls ──────────────────────────────────────────────────────
    this._addBox(W,   H, 0.5,   0, H/2, -hd, mats.wall); // North
    this._addBox(W,   H, 0.5,   0, H/2,  hd, mats.wall); // South
    this._addBox(0.5, H, D,   hw, H/2,   0,  mats.wall); // East
    this._addBox(0.5, H, D,  -hw, H/2,   0,  mats.wall); // West

    // ── Custom objects ─────────────────────────────────────────────────────────
    for (const obj of d.objects ?? []) {
      const mat = mats[obj.mat] ?? mats.wall;
      this._addBox(obj.w, obj.h, obj.d, obj.x, obj.y, obj.z, mat);
    }

    // ── Spawn points ───────────────────────────────────────────────────────────
    this._spawnPoints = (d.spawnPoints ?? []).map(sp => new THREE.Vector3(sp.x, 0, sp.z));
    if (this._spawnPoints.length === 0) {
      this._spawnPoints = [
        new THREE.Vector3(-22, 0, -22), new THREE.Vector3( 22, 0, -22),
        new THREE.Vector3(-22, 0,  22), new THREE.Vector3( 22, 0,  22),
      ];
    }

    // ── Lighting ───────────────────────────────────────────────────────────────
    this._group.add(new THREE.AmbientLight(0x8899bb, 2.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(0, 10, 0);
    this._group.add(dir);

    [
      [0,      5,  0,     0x99aacc, 50, 3.0],
      [-hw+8,  4, -hd+8,  0xff8844, 22, 2.5],
      [ hw-8,  4, -hd+8,  0xff8844, 22, 2.5],
      [-hw+8,  4,  hd-8,  0xff8844, 22, 2.5],
      [ hw-8,  4,  hd-8,  0xff8844, 22, 2.5],
    ].forEach(([lx, ly, lz, color, dist, intensity]) => {
      const l = new THREE.PointLight(color, intensity, dist);
      l.position.set(lx, ly, lz);
      this._group.add(l);
    });

    return this._group;
  }

  _addBox(w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    this._group.add(mesh);
    this._colliders.push({
      min: new THREE.Vector3(x - w/2, y - h/2, z - d/2),
      max: new THREE.Vector3(x + w/2, y + h/2, z + d/2),
    });
    return mesh;
  }

  getColliders()   { return this._colliders; }
  getSpawnPoints() { return this._spawnPoints; }
  getPlayerStart() {
    const ps = this._data.playerStart;
    return ps ? new THREE.Vector3(ps.x, 0.1, ps.z) : new THREE.Vector3(0, 0.1, 0);
  }
  getBounds() {
    const hw = (this._data.width  ?? 60) / 2 - 1;
    const hd = (this._data.depth  ?? 60) / 2 - 1;
    return { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd };
  }
}
