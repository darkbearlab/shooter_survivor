// editor-main.js — wires EditorState, GridView, Preview3D, and the UI.

import { EditorState } from './EditorState.js';
import { GridView    } from './GridView.js';
import { Preview3D   } from './Preview3D.js';

// ── State ─────────────────────────────────────────────────────────────────────

const state = new EditorState();

// ── Grid view ─────────────────────────────────────────────────────────────────

const gridCanvas = document.getElementById('grid-canvas');
const grid = new GridView(gridCanvas, state);

function resizeGrid() {
  const panel = gridCanvas.parentElement;
  const w = panel.clientWidth;
  const h = panel.clientHeight;
  gridCanvas.width  = w;
  gridCanvas.height = h;
  grid.render();
}
window.addEventListener('resize', resizeGrid);
resizeGrid();
grid.centerMap();

// ── 3D preview ────────────────────────────────────────────────────────────────

const previewCanvas = document.getElementById('preview-canvas');
const preview = new Preview3D(previewCanvas, state);

// ── Tool buttons ──────────────────────────────────────────────────────────────

const toolBtns = document.querySelectorAll('[data-tool]');
toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    grid.setTool(btn.dataset.tool);
  });
});
// Activate first tool by default
toolBtns[0]?.classList.add('active');

// ── Map properties panel ──────────────────────────────────────────────────────

const nameInput  = document.getElementById('prop-name');
const widthInput = document.getElementById('prop-width');
const depthInput = document.getElementById('prop-depth');
const heightInput = document.getElementById('prop-height');

function syncPropsFromState() {
  nameInput.value   = state.name;
  widthInput.value  = state.width;
  depthInput.value  = state.depth;
  heightInput.value = state.wallHeight;
}

nameInput.addEventListener('input',   () => { state.setName(nameInput.value); });
widthInput.addEventListener('change', () => {
  const v = Math.max(10, Math.min(200, parseInt(widthInput.value) || 60));
  widthInput.value = v;
  state.setDimensions(v, state.depth);
  grid.centerMap();
});
depthInput.addEventListener('change', () => {
  const v = Math.max(10, Math.min(200, parseInt(depthInput.value) || 60));
  depthInput.value = v;
  state.setDimensions(state.width, v);
  grid.centerMap();
});
heightInput.addEventListener('change', () => {
  const v = Math.max(2, Math.min(20, parseFloat(heightInput.value) || 6));
  heightInput.value = v;
  state.setWallHeight(v);
});

syncPropsFromState();

// ── Object selection & properties ────────────────────────────────────────────

const objPanel = document.getElementById('obj-panel');
const objX  = document.getElementById('obj-x');
const objY  = document.getElementById('obj-y');
const objZ  = document.getElementById('obj-z');
const objW  = document.getElementById('obj-w');
const objH  = document.getElementById('obj-h');
const objD  = document.getElementById('obj-d');
const objMat = document.getElementById('obj-mat');
const objDel = document.getElementById('obj-del');

let selectedId = null;

function selectObject(id) {
  selectedId = id;
  if (id == null) { objPanel.classList.add('hidden'); return; }
  const obj = state.objects.find(o => o.id === id);
  if (!obj) { objPanel.classList.add('hidden'); return; }
  objPanel.classList.remove('hidden');
  objX.value = obj.x;  objY.value = obj.y;  objZ.value = obj.z;
  objW.value = obj.w;  objH.value = obj.h;  objD.value = obj.d;
  objMat.value = obj.mat;
}

function numVal(el) { return parseFloat(el.value) || 0; }

function pushObjChanges() {
  if (selectedId == null) return;
  state.updateObject(selectedId, {
    x: numVal(objX), y: numVal(objY), z: numVal(objZ),
    w: Math.max(0.5, numVal(objW)),
    h: Math.max(0.5, numVal(objH)),
    d: Math.max(0.5, numVal(objD)),
    mat: objMat.value,
  });
  selectObject(selectedId);
}

[objX, objY, objZ, objW, objH, objD].forEach(el => el.addEventListener('change', pushObjChanges));
objMat.addEventListener('change', pushObjChanges);

objDel.addEventListener('click', () => {
  if (selectedId != null) { state.removeObject(selectedId); selectObject(null); }
});

// Click on grid to select object
gridCanvas.addEventListener('click', e => {
  const r = gridCanvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  // Use internal grid method — inject a tiny helper
  const { mx, mz } = grid._canvasToMap(cx, cy);
  let found = null;
  for (const obj of state.objects) {
    if (mx >= obj.x - obj.w/2 && mx <= obj.x + obj.w/2 &&
        mz >= obj.z - obj.d/2 && mz <= obj.z + obj.d/2) {
      found = obj.id; break;
    }
  }
  selectObject(found);
});

// Deselect when state changes and selected object no longer exists
state.onChange(() => {
  if (selectedId != null && !state.objects.find(o => o.id === selectedId)) {
    selectObject(null);
  }
  syncPropsFromState();
  updateCounts();
});

// ── Status counts ─────────────────────────────────────────────────────────────

const countObjects = document.getElementById('count-objects');
const countSpawns  = document.getElementById('count-spawns');
const countRes     = document.getElementById('count-resources');

function updateCounts() {
  countObjects.textContent = state.objects.length;
  countSpawns.textContent  = state.spawnPoints.length;
  countRes.textContent     = state.resourceNodes.length;
}
updateCounts();

// ── New / Export / Import ─────────────────────────────────────────────────────

document.getElementById('btn-new').addEventListener('click', () => {
  if (!confirm('Create a new map? Unsaved changes will be lost.')) return;
  state.newMap();
  grid.centerMap();
  selectObject(null);
  syncPropsFromState();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const json = JSON.stringify(state.toJSON(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (state.name || 'map').replace(/\s+/g, '_') + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        state.fromJSON(data);
        grid.centerMap();
        selectObject(null);
        syncPropsFromState();
      } catch (err) {
        alert('Failed to load map: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

// ── Center view button ────────────────────────────────────────────────────────

document.getElementById('btn-center').addEventListener('click', () => grid.centerMap());

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

const TOOL_KEYS = {
  '1': 'box', '2': 'pillar', '3': 'platform',
  'e': 'erase', 's': 'spawn', 'r': 'resource', 'p': 'playerStart',
};

window.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  const tool = TOOL_KEYS[e.key];
  if (tool) {
    const btn = document.querySelector(`[data-tool="${tool}"]`);
    btn?.click();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId != null) { state.removeObject(selectedId); selectObject(null); }
  }
});
