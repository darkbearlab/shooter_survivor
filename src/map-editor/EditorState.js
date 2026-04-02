// EditorState — single source of truth for the map being edited.
// All mutations go through methods here so listeners get notified.

export class EditorState {
  constructor() {
    this._listeners = [];
    this._nextId    = 1;
    this.newMap();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  newMap() {
    this.name         = 'Untitled Map';
    this.width        = 60;
    this.depth        = 60;
    this.wallHeight   = 6;
    this.objects      = [];      // { id, type, x, y, z, w, h, d, mat }
    this.spawnPoints  = [];      // { x, z }
    this.resourceNodes = [];     // { x, z }
    this.playerStart  = { x: 0, z: 0 };
    this._nextId      = 1;
    this._emit();
  }

  // ── Observers ────────────────────────────────────────────────────────────────

  onChange(fn) { this._listeners.push(fn); }
  _emit()      { this._listeners.forEach(fn => fn(this)); }

  // ── Objects ──────────────────────────────────────────────────────────────────

  addObject(obj) {
    const o = { ...obj, id: this._nextId++ };
    this.objects.push(o);
    this._emit();
    return o.id;
  }

  updateObject(id, changes) {
    const obj = this.objects.find(o => o.id === id);
    if (obj) { Object.assign(obj, changes); this._emit(); }
  }

  removeObject(id) {
    this.objects = this.objects.filter(o => o.id !== id);
    this._emit();
  }

  // ── Map properties ────────────────────────────────────────────────────────

  setDimensions(width, depth) { this.width = width; this.depth = depth; this._emit(); }
  setWallHeight(h)             { this.wallHeight = h; this._emit(); }
  setName(name)                { this.name = name; }   // no rebuild needed

  // ── Points ───────────────────────────────────────────────────────────────────

  addSpawnPoint(x, z)      { this.spawnPoints.push({ x, z });  this._emit(); }
  removeSpawnPoint(idx)    { this.spawnPoints.splice(idx, 1);  this._emit(); }
  addResourceNode(x, z)    { this.resourceNodes.push({ x, z }); this._emit(); }
  removeResourceNode(idx)  { this.resourceNodes.splice(idx, 1); this._emit(); }
  setPlayerStart(x, z)     { this.playerStart = { x, z };      this._emit(); }

  // ── Serialization ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      name:          this.name,
      width:         this.width,
      depth:         this.depth,
      wallHeight:    this.wallHeight,
      objects:       this.objects.map(({ id, ...rest }) => rest), // strip internal id
      spawnPoints:   this.spawnPoints.map(p => ({ ...p })),
      resourceNodes: this.resourceNodes.map(p => ({ ...p })),
      playerStart:   { ...this.playerStart },
    };
  }

  fromJSON(data) {
    this.name          = data.name          ?? 'Untitled';
    this.width         = data.width         ?? 60;
    this.depth         = data.depth         ?? 60;
    this.wallHeight    = data.wallHeight    ?? 6;
    this.objects       = (data.objects      ?? []).map((o, i) => ({ ...o, id: i + 1 }));
    this.spawnPoints   = (data.spawnPoints  ?? []).map(p => ({ ...p }));
    this.resourceNodes = (data.resourceNodes ?? []).map(p => ({ ...p }));
    this.playerStart   = data.playerStart   ? { ...data.playerStart } : { x: 0, z: 0 };
    this._nextId       = this.objects.length + 1;
    this._emit();
  }
}
