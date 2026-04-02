// BalanceMenu — Phase 10 real-time balance parameter adjustment.
// Open/close with Tab. Changes apply instantly; Reset restores original values.
// Mutates CHARACTERS[].baseStats, WEAPON_DEFS, and ENEMY_DEFS directly.

import { CHARACTERS } from '../characters.js';
import { WEAPON_DEFS } from '../weapons.js';
import { ENEMY_DEFS }  from '../enemies.js';

export class BalanceMenu {
  constructor() {
    this._el       = document.getElementById('balance-menu');
    this._defaults = this._snapshot();
    this._built    = false;
    this._onClose  = null;
  }

  show(onClose) {
    this._onClose = onClose;
    if (!this._built) { this._buildUI(); this._built = true; }
    this._el.classList.remove('hidden');
  }

  hide() {
    this._el.classList.add('hidden');
    if (this._onClose) this._onClose();
  }

  // ── Snapshot / Reset ────────────────────────────────────────────────────────

  _snapshot() {
    return {
      characters: CHARACTERS.map(c => ({ id: c.id, stats: { ...c.baseStats } })),
      weapons:    Object.fromEntries(Object.entries(WEAPON_DEFS).map(([id, d]) => [id, { ...d }])),
      enemies:    Object.fromEntries(Object.entries(ENEMY_DEFS).map(([id, d]) => [id, { ...d }])),
    };
  }

  _resetAll() {
    for (const snap of this._defaults.characters) {
      const c = CHARACTERS.find(c => c.id === snap.id);
      if (c) Object.assign(c.baseStats, snap.stats);
    }
    for (const [id, snap] of Object.entries(this._defaults.weapons)) Object.assign(WEAPON_DEFS[id], snap);
    for (const [id, snap] of Object.entries(this._defaults.enemies)) Object.assign(ENEMY_DEFS[id],  snap);
    // Rebuild so sliders reflect reset values
    this._built = false;
    this._el.innerHTML = '';
    this._buildUI();
    this._built = true;
  }

  // ── Build UI ────────────────────────────────────────────────────────────────

  _buildUI() {
    this._el.innerHTML = '';

    // ── Fixed header ──
    const header = document.createElement('div');
    header.className = 'bm-header';
    const title = document.createElement('h1');
    title.textContent = 'BALANCE SETTINGS';
    const hint = document.createElement('div');
    hint.className = 'bm-hint';
    hint.textContent = 'Changes apply immediately — Tab to close';
    const btnRow = document.createElement('div');
    btnRow.className = 'bm-btn-row';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'RESET ALL';
    resetBtn.className = 'bm-btn reset';
    resetBtn.onclick = () => this._resetAll();
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'CLOSE [Tab]';
    closeBtn.className = 'bm-btn';
    closeBtn.onclick = () => this.hide();
    btnRow.append(resetBtn, closeBtn);
    header.append(title, hint, btnRow);
    this._el.appendChild(header);

    // ── Scrollable body with 3 columns ──
    const body = document.createElement('div');
    body.className = 'bm-body';

    const colChar = document.createElement('div');
    colChar.className = 'bm-col';
    const colWep  = document.createElement('div');
    colWep.className = 'bm-col';
    const colEnemy = document.createElement('div');
    colEnemy.className = 'bm-col';

    // ── Characters ──
    for (const char of CHARACTERS) {
      const s = char.baseStats;
      colChar.appendChild(this._section(`CHAR: ${char.name}`, [
        this._row('Max HP',        s.maxHp,            50, 500,   5,   v => { s.maxHp = v; }),
        this._row('Max Armor',     s.maxArmor,          0, 200,   5,   v => { s.maxArmor = v; }),
        this._row('Move Speed ×',  s.moveSpeed,       0.5,   2, 0.05,  v => { s.moveSpeed = v; }),
        this._row('Damage ×',      s.damageMultiplier, 0.5,   3, 0.05, v => { s.damageMultiplier = v; }),
        this._row('Reload ×',      s.reloadMultiplier, 0.3,   2, 0.05, v => { s.reloadMultiplier = v; }),
      ]));
    }

    // ── Weapons ──
    for (const [id, def] of Object.entries(WEAPON_DEFS)) {
      const rows = [
        this._row('Damage',     def.damage,    1, 500,  1,    v => { def.damage = v; }),
        this._row('Fire Rate',  def.fireRate, 0.05, 5, 0.01,  v => { def.fireRate = v; }),
      ];
      if (def.type !== 'melee') {
        rows.push(this._row('Reload Time',  def.reloadTime,  0.2, 5,  0.1, v => { def.reloadTime = v; }));
        rows.push(this._row('Mag Size',     def.magSize,       1, 100, 1,  v => { def.magSize = Math.round(v); }));
        rows.push(this._row('Max Reserve',  def.reserveAmmo,   1, 500, 1,  v => { def.reserveAmmo = Math.round(v); }));
      }
      if (def.pellets > 1)    rows.push(this._row('Pellets',       def.pellets,      1, 20,   1, v => { def.pellets = Math.round(v); }));
      if (def.splashRadius)   rows.push(this._row('Splash Radius', def.splashRadius, 0, 15, 0.5, v => { def.splashRadius = v; }));
      if (def.splashDamage)   rows.push(this._row('Splash Dmg',    def.splashDamage, 0, 500,  1, v => { def.splashDamage = v; }));
      if (def.range != null)  rows.push(this._row('Range',         def.range,        5, 300,  5, v => { def.range = v; }));
      colWep.appendChild(this._section(`WEAPON: ${def.name}`, rows));
    }

    // ── Enemies ──
    for (const [id, def] of Object.entries(ENEMY_DEFS)) {
      colEnemy.appendChild(this._section(`ENEMY: ${id.toUpperCase()}`, [
        this._row('HP',           def.hp,          10, 2000, 10, v => { def.hp = v; }),
        this._row('Speed',        def.speed,       0.5,  15, 0.5, v => { def.speed = v; }),
        this._row('Damage',       def.damage,        1, 100,   1, v => { def.damage = v; }),
        this._row('Attack Rate',  def.attackRate,  0.2,   5, 0.1, v => { def.attackRate = v; }),
        this._row('Attack Range', def.attackRange,   1,  25, 0.5, v => { def.attackRange = v; }),
      ]));
    }

    body.append(colChar, colWep, colEnemy);
    this._el.appendChild(body);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _section(title, rows) {
    const sec = document.createElement('div');
    sec.className = 'bm-section';
    const h = document.createElement('div');
    h.className = 'bm-section-title';
    h.textContent = title;
    sec.append(h, ...rows);
    return sec;
  }

  _row(label, value, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'bm-row';

    const lbl = document.createElement('span');
    lbl.className = 'bm-label';
    lbl.textContent = label;

    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = min; inp.max = max; inp.step = step;
    inp.value = value;
    inp.className = 'bm-slider';

    const val = document.createElement('span');
    val.className = 'bm-val';
    val.textContent = step < 1 ? (+value).toFixed(step < 0.05 ? 2 : 1) : Math.round(value);

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      val.textContent = step < 1 ? v.toFixed(step < 0.05 ? 2 : 1) : Math.round(v);
      onChange(v);
    });

    row.append(lbl, inp, val);
    return row;
  }
}
