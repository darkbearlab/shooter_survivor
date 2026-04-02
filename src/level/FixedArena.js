import * as THREE from 'three';
import { IMapBuilder } from './IMapBuilder.js';
import { makeWallTexture, makeFloorTexture, makeCeilingTexture, makeColumnTexture } from '../utils/PlaceholderTextures.js';

const ARENA_W = 60;
const ARENA_D = 60;
const WALL_H  = 6;

export class FixedArena extends IMapBuilder {
  constructor() {
    super();
    this._colliders   = [];
    this._spawnPoints = [];
    this._group       = new THREE.Group();
    this.wallHeight   = WALL_H;
  }

  build() {
    const wallTex  = makeWallTexture();
    const floorTex = makeFloorTexture();
    const ceilTex  = makeCeilingTexture();
    const colTex   = makeColumnTexture();

    [wallTex, floorTex, ceilTex, colTex].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    wallTex.repeat.set(4, 2);
    floorTex.repeat.set(16, 16);
    ceilTex.repeat.set(16, 16);

    const wallMat  = new THREE.MeshLambertMaterial({ map: wallTex });
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const ceilMat  = new THREE.MeshLambertMaterial({ map: ceilTex });
    const colMat   = new THREE.MeshLambertMaterial({ map: colTex });

    const hw = ARENA_W / 2;
    const hd = ARENA_D / 2;

    // ── Floor & Ceiling ───────────────────────────────────────────────────────
    this._addBox(ARENA_W, 0.2, ARENA_D,  0, -0.1,       0, floorMat);
    this._addBox(ARENA_W, 0.2, ARENA_D,  0, WALL_H + 0.1, 0, ceilMat);

    // ── Outer Walls ───────────────────────────────────────────────────────────
    this._addBox(ARENA_W, WALL_H, 0.5,  0,  WALL_H/2, -hd, wallMat); // North
    this._addBox(ARENA_W, WALL_H, 0.5,  0,  WALL_H/2,  hd, wallMat); // South
    this._addBox(0.5, WALL_H, ARENA_D,  hw, WALL_H/2,   0, wallMat); // East
    this._addBox(0.5, WALL_H, ARENA_D, -hw, WALL_H/2,   0, wallMat); // West

    // ── Pillars ───────────────────────────────────────────────────────────────
    // 4 central pillars
    [[-8,-8],[8,-8],[-8,8],[8,8]].forEach(([px, pz]) => {
      this._addBox(1.5, WALL_H, 1.5, px, WALL_H/2, pz, colMat);
    });

    // 8 mid-ring pillars
    [
      [-20, 0], [20, 0], [0, -20], [0, 20],
      [-14,-14],[14,-14],[-14,14],[14,14],
    ].forEach(([px, pz]) => {
      this._addBox(1.5, WALL_H, 1.5, px, WALL_H/2, pz, colMat);
    });

    // ── Spawn points ─────────────────────────────────────────────────────────
    this._spawnPoints = [
      new THREE.Vector3(-22, 0,  -22),
      new THREE.Vector3( 22, 0,  -22),
      new THREE.Vector3(-22, 0,   22),
      new THREE.Vector3( 22, 0,   22),
      new THREE.Vector3(  0, 0,  -25),
      new THREE.Vector3(  0, 0,   25),
      new THREE.Vector3(-25, 0,    0),
      new THREE.Vector3( 25, 0,    0),
    ];

    // ── Lighting ─────────────────────────────────────────────────────────────
    this._group.add(new THREE.AmbientLight(0x8899bb, 2.0));

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(0, 10, 0);
    this._group.add(dir);

    [
      [0,    5,  0,     0x99aacc, 50, 3.0],
      [-hw+8, 4, -hd+8, 0xff8844, 22, 2.5],
      [ hw-8, 4, -hd+8, 0xff8844, 22, 2.5],
      [-hw+8, 4,  hd-8, 0xff8844, 22, 2.5],
      [ hw-8, 4,  hd-8, 0xff8844, 22, 2.5],
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
  getPlayerStart() { return new THREE.Vector3(0, 0.1, 0); }
  getBounds() {
    const hw = ARENA_W / 2 - 1;
    const hd = ARENA_D / 2 - 1;
    return { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd };
  }
}
