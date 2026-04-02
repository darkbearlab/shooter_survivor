// GridView — 2D top-down canvas editor for placing map objects.
// Tools: box | pillar | platform | erase | spawn | resource | playerStart
// Drag to draw boxes; click for point tools.

export class GridView {
  constructor(canvas, state) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._state   = state;
    this._tool    = 'box';
    this._cellPx  = 14;       // pixels per map unit
    this._offsetX = 0;        // pan offset (canvas px)
    this._offsetZ = 0;
    this._drag    = null;     // { startMx, startMz, curMx, curMz }
    this._hovered = null;     // object id under mouse
    this._panning = false;
    this._panStart = null;
    this._panOffsetStart = null;

    this._bindEvents();
    state.onChange(() => this.render());
  }

  setTool(t) { this._tool = t; this._drag = null; }

  // ── Coordinate helpers ────────────────────────────────────────────────────

  // Canvas pixel → map coordinates (continuous)
  _canvasToMap(cx, cy) {
    const s = this._state;
    const hw = s.width / 2, hd = s.depth / 2;
    const mx = (cx - this._offsetX) / this._cellPx - hw;
    const mz = (cy - this._offsetZ) / this._cellPx - hd;
    return { mx, mz };
  }

  // Map coordinates → canvas pixel
  _mapToCanvas(mx, mz) {
    const s = this._state;
    const hw = s.width / 2, hd = s.depth / 2;
    const cx = (mx + hw) * this._cellPx + this._offsetX;
    const cy = (mz + hd) * this._cellPx + this._offsetZ;
    return { cx, cy };
  }

  _snapUnit(v) { return Math.round(v); }

  // ── Events ────────────────────────────────────────────────────────────────

  _bindEvents() {
    const cv = this._canvas;
    cv.addEventListener('mousedown', e => this._onDown(e));
    cv.addEventListener('mousemove', e => this._onMove(e));
    cv.addEventListener('mouseup',   e => this._onUp(e));
    cv.addEventListener('wheel',     e => this._onWheel(e), { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  _pos(e) {
    const r = this._canvas.getBoundingClientRect();
    return { cx: e.clientX - r.left, cy: e.clientY - r.top };
  }

  _onDown(e) {
    e.preventDefault();
    const { cx, cy } = this._pos(e);

    // Middle mouse or Alt+Left = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this._panning = true;
      this._panStart = { cx, cy };
      this._panOffsetStart = { x: this._offsetX, z: this._offsetZ };
      return;
    }

    if (e.button === 2) { this._eraseAt(cx, cy); return; }
    if (e.button !== 0) return;

    const { mx, mz } = this._canvasToMap(cx, cy);
    const tool = this._tool;

    if (tool === 'spawn') {
      const x = this._snapUnit(mx), z = this._snapUnit(mz);
      this._state.addSpawnPoint(x, z);
      return;
    }
    if (tool === 'resource') {
      const x = this._snapUnit(mx), z = this._snapUnit(mz);
      this._state.addResourceNode(x, z);
      return;
    }
    if (tool === 'playerStart') {
      const x = this._snapUnit(mx), z = this._snapUnit(mz);
      this._state.setPlayerStart(x, z);
      return;
    }
    if (tool === 'erase') {
      this._eraseAt(cx, cy);
      return;
    }

    // box / pillar / platform — begin drag
    this._drag = { startMx: mx, startMz: mz, curMx: mx, curMz: mz };
  }

  _onMove(e) {
    const { cx, cy } = this._pos(e);

    if (this._panning) {
      this._offsetX = this._panOffsetStart.x + (cx - this._panStart.cx);
      this._offsetZ = this._panOffsetStart.z + (cy - this._panStart.cy);
      this.render();
      return;
    }

    const { mx, mz } = this._canvasToMap(cx, cy);
    if (this._drag) {
      this._drag.curMx = mx;
      this._drag.curMz = mz;
    }

    // Hover detection
    this._hovered = null;
    for (const obj of this._state.objects) {
      if (mx >= obj.x - obj.w/2 && mx <= obj.x + obj.w/2 &&
          mz >= obj.z - obj.d/2 && mz <= obj.z + obj.d/2) {
        this._hovered = obj.id;
        break;
      }
    }
    this.render();
  }

  _onUp(e) {
    if (this._panning) { this._panning = false; return; }
    if (!this._drag || e.button !== 0) return;

    const { startMx, startMz, curMx, curMz } = this._drag;
    this._drag = null;

    // Snap to cell edges: floor the near side, ceil the far side.
    // This ensures any click within a cell places the object in that cell.
    const x0 = Math.floor(Math.min(startMx, curMx));
    const x1 = Math.ceil (Math.max(startMx, curMx));
    const z0 = Math.floor(Math.min(startMz, curMz));
    const z1 = Math.ceil (Math.max(startMz, curMz));

    const w  = Math.max(1, x1 - x0);
    const d  = Math.max(1, z1 - z0);
    const cx = x0 + w / 2;   // exact half-integer center
    const cz = z0 + d / 2;

    const tool = this._tool;
    let obj;
    if (tool === 'box') {
      obj = { type: 'box', x: cx, y: 3, z: cz, w, h: 6, d, mat: 'wall' };
    } else if (tool === 'pillar') {
      const size = Math.max(1, Math.min(w, d));
      obj = { type: 'pillar', x: cx, y: 3, z: cz, w: size, h: 6, d: size, mat: 'column' };
    } else if (tool === 'platform') {
      obj = { type: 'platform', x: cx, y: 2, z: cz, w, h: 0.5, d, mat: 'floor' };
    } else {
      return;
    }

    // Only add if the drag had some size
    if (w >= 0.5 && d >= 0.5) {
      this._state.addObject(obj);
    }
    this.render();
  }

  _onWheel(e) {
    e.preventDefault();
    const { cx, cy } = this._pos(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newCell = Math.max(4, Math.min(40, this._cellPx * factor));
    // Zoom toward mouse position
    const { mx, mz } = this._canvasToMap(cx, cy);
    this._cellPx = newCell;
    const s = this._state;
    const hw = s.width / 2, hd = s.depth / 2;
    this._offsetX = cx - (mx + hw) * this._cellPx;
    this._offsetZ = cy - (mz + hd) * this._cellPx;
    this.render();
  }

  _eraseAt(cx, cy) {
    const { mx, mz } = this._canvasToMap(cx, cy);
    // Erase objects
    for (const obj of [...this._state.objects]) {
      if (mx >= obj.x - obj.w/2 && mx <= obj.x + obj.w/2 &&
          mz >= obj.z - obj.d/2 && mz <= obj.z + obj.d/2) {
        this._state.removeObject(obj.id);
        return;
      }
    }
    // Erase spawn points (within 1.5 units)
    for (let i = this._state.spawnPoints.length - 1; i >= 0; i--) {
      const sp = this._state.spawnPoints[i];
      if (Math.hypot(mx - sp.x, mz - sp.z) < 1.5) {
        this._state.removeSpawnPoint(i);
        return;
      }
    }
    // Erase resource nodes
    for (let i = this._state.resourceNodes.length - 1; i >= 0; i--) {
      const rn = this._state.resourceNodes[i];
      if (Math.hypot(mx - rn.x, mz - rn.z) < 1.5) {
        this._state.removeResourceNode(i);
        return;
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    const { _ctx: ctx, _canvas: cv, _state: s, _cellPx: cell } = this;
    ctx.clearRect(0, 0, cv.width, cv.height);

    // Background
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(0, 0, cv.width, cv.height);

    const hw = s.width / 2, hd = s.depth / 2;

    // ── Grid lines ──
    ctx.strokeStyle = '#2a2a38';
    ctx.lineWidth = 1;
    for (let mx = -hw; mx <= hw; mx++) {
      const { cx } = this._mapToCanvas(mx, 0);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cv.height); ctx.stroke();
    }
    for (let mz = -hd; mz <= hd; mz++) {
      const { cy } = this._mapToCanvas(0, mz);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cv.width, cy); ctx.stroke();
    }

    // ── Map boundary ──
    const { cx: bx0, cy: by0 } = this._mapToCanvas(-hw, -hd);
    const bw = s.width * cell, bd = s.depth * cell;
    ctx.strokeStyle = '#5566aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx0, by0, bw, bd);

    // ── Floor fill ──
    ctx.fillStyle = 'rgba(30,32,50,0.6)';
    ctx.fillRect(bx0, by0, bw, bd);

    // ── Objects ──
    for (const obj of s.objects) {
      const { cx, cy } = this._mapToCanvas(obj.x - obj.w/2, obj.z - obj.d/2);
      const ow = obj.w * cell, od = obj.d * cell;

      const isHovered = obj.id === this._hovered;
      ctx.fillStyle = OBJ_COLORS[obj.mat] ?? '#556677';
      if (isHovered) ctx.fillStyle = lighten(ctx.fillStyle);
      ctx.fillRect(cx, cy, ow, od);

      ctx.strokeStyle = isHovered ? '#ffffff' : '#88aacc';
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.strokeRect(cx, cy, ow, od);

      // Label
      if (ow > 28 && od > 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${Math.min(11, od * 0.45)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.type, cx + ow/2, cy + od/2);
      }
    }

    // ── Drag preview ──
    if (this._drag) {
      const { startMx, startMz, curMx, curMz } = this._drag;
      const { cx: px0, cy: pz0 } = this._mapToCanvas(Math.min(startMx, curMx), Math.min(startMz, curMz));
      const pw = Math.abs(curMx - startMx) * cell;
      const pd = Math.abs(curMz - startMz) * cell;
      ctx.fillStyle = 'rgba(100,160,255,0.25)';
      ctx.fillRect(px0, pz0, pw, pd);
      ctx.strokeStyle = '#88bbff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(px0, pz0, pw, pd);
      ctx.setLineDash([]);
    }

    // ── Spawn points ──
    for (const sp of s.spawnPoints) {
      this._drawPoint(sp.x, sp.z, '#44ff88', 'S');
    }

    // ── Resource nodes ──
    for (const rn of s.resourceNodes) {
      this._drawPoint(rn.x, rn.z, '#ffdd44', 'R');
    }

    // ── Player start ──
    if (s.playerStart) {
      this._drawPoint(s.playerStart.x, s.playerStart.z, '#ff6644', 'P');
    }

    // ── Ruler ──
    this._drawRuler();
  }

  _drawPoint(mx, mz, color, label) {
    const { cx, cy } = this._mapToCanvas(mx, mz);
    const r = Math.max(5, this._cellPx * 0.55);
    this._ctx.beginPath();
    this._ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this._ctx.fillStyle = color + '99';
    this._ctx.fill();
    this._ctx.strokeStyle = color;
    this._ctx.lineWidth = 2;
    this._ctx.stroke();
    this._ctx.fillStyle = color;
    this._ctx.font = `bold ${Math.min(10, r)}px monospace`;
    this._ctx.textAlign = 'center';
    this._ctx.textBaseline = 'middle';
    this._ctx.fillText(label, cx, cy);
  }

  _drawRuler() {
    const ctx = this._ctx, s = this._state, cell = this._cellPx;
    const { cx: ox, cy: oy } = this._mapToCanvas(0, 0);
    // 10-unit scale bar
    const barW = 10 * cell;
    const bx = 12, by = this._canvas.height - 18;
    ctx.fillStyle = '#ffffff88';
    ctx.fillRect(bx, by - 4, barW, 3);
    ctx.fillStyle = '#ccc';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`10 units`, bx, by - 6);
  }

  // ── Resize canvas to container ────────────────────────────────────────────

  resize(w, h) {
    // Keep map centered after resize
    const oldW = this._canvas.width, oldH = this._canvas.height;
    this._canvas.width  = w;
    this._canvas.height = h;
    this._offsetX += (w - oldW) / 2;
    this._offsetZ += (h - oldH) / 2;
    this.render();
  }

  centerMap() {
    const s = this._state;
    this._cellPx = Math.min(
      (this._canvas.width  * 0.85) / s.width,
      (this._canvas.height * 0.85) / s.depth,
    );
    this._offsetX = (this._canvas.width  - s.width  * this._cellPx) / 2;
    this._offsetZ = (this._canvas.height - s.depth  * this._cellPx) / 2;
    this.render();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const OBJ_COLORS = {
  wall:    '#4a5580',
  floor:   '#5a7a5a',
  ceiling: '#6a5a7a',
  column:  '#7a5a4a',
};

function lighten(hex) {
  // Crude lighten — just add 0x22 to each channel
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 0x33);
  const g = Math.min(255, ((n >>  8) & 0xff) + 0x33);
  const b = Math.min(255, ((n >>  0) & 0xff) + 0x33);
  return `rgb(${r},${g},${b})`;
}
