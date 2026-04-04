// LoadoutSelect — free-form loadout builder.
// Player picks 2 weapons + 1 active skill + any passives within a 5-point budget.
// Negative passives (nerfs) return budget so the player can take more buffs.
// Produces a synthetic charDef object compatible with Player constructor.

import { WEAPON_DEFS } from '../weapons.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUDGET_MAX = 5;

const LOADOUT_WEAPONS = [
  { id: 'shotgun',    cost: 1, stat: '7×15 dmg | spread' },
  { id: 'railgun',    cost: 1, stat: '120 dmg | pierce' },
  { id: 'rocket',     cost: 1, stat: '80+60 splash | jump' },
  { id: 'machinegun', cost: 1, stat: '12 dmg × 11/s' },
  { id: 'nailgun',    cost: 1, stat: '45 dmg | projectile' },
  { id: 'fists',      cost: 1, stat: '80 dmg | melee' },
];

const LOADOUT_ACTIVES = [
  {
    id: 'grenade', name: 'GRENADE', cost: 1, cooldown: 8,
    icon: '💣', desc: '3s fuse, bounces off walls. Cooldown 8s.',
  },
  {
    id: 'pulse', name: 'PULSE BLAST', cost: 1, cooldown: 12,
    icon: '🔵', desc: 'Destroys all enemy projectiles in radius ~8. Cooldown 12s.',
  },
];

const LOADOUT_PASSIVES = [
  // ── Buffs (cost +1) ────────────────────────────────────────────────────────
  { id: 'hp_up',           cost:  1, icon: '❤',  name: '+30 最大HP',
    statMod: { maxHp: +30 } },
  { id: 'armor_up',        cost:  1, icon: '🛡',  name: '+25 最大護甲',
    statMod: { maxArmor: +25 } },
  { id: 'speed_up',        cost:  1, icon: '⚡',  name: '移動速度 +15%',
    statMod: { moveSpeed: +0.15 } },
  { id: 'ammo_up',         cost:  1, icon: '📦',  name: '備彈量 +30%',
    statMod: { reserveMult: +0.30 } },
  { id: 'drop_up',         cost:  1, icon: '🎰',  name: '掉落率 +15%',
    dropMod: { enemyDropChance: +0.15 } },
  { id: 'ammodrop_up',     cost:  1, icon: '🔋',  name: '彈藥掉落量 +30%',
    dropMod: { ammoMultiplier: +0.30 } },
  { id: 'regen_up',        cost:  1, icon: '💚',  name: '每5秒回復 +2 HP',
    statMod: { hpRegen: +2 } },
  { id: 'combat_instinct', cost:  1, icon: '🎯',  name: '戰鬥本能',
    desc: '連殺3人後下一槍雙倍傷害', behaviorId: 'combat_instinct' },
  { id: 'heavy_armor',     cost:  1, icon: '🪖',  name: '重甲',
    desc: '護甲吸收傷害從67%提升至80%', behaviorId: 'heavy_armor' },
  // ── Nerfs (cost -1) ────────────────────────────────────────────────────────
  { id: 'hp_down',         cost: -1, icon: '💔',  name: '-30 最大HP',
    statMod: { maxHp: -30 } },
  { id: 'armor_down',      cost: -1, icon: '🩹',  name: '-25 最大護甲',
    statMod: { maxArmor: -25 } },
  { id: 'speed_down',      cost: -1, icon: '🐢',  name: '移動速度 -15%',
    statMod: { moveSpeed: -0.15 } },
  { id: 'ammo_down',       cost: -1, icon: '📉',  name: '備彈量 -30%',
    statMod: { reserveMult: -0.30 } },
  { id: 'drop_down',       cost: -1, icon: '🔻',  name: '掉落率 -15%',
    dropMod: { enemyDropChance: -0.15 } },
  { id: 'ammodrop_down',   cost: -1, icon: '⬇',   name: '彈藥掉落量 -30%',
    dropMod: { ammoMultiplier: -0.30 } },
  { id: 'regen_down',      cost: -1, icon: '☠',   name: '每5秒失去 1 HP',
    statMod: { hpRegen: -1 } },
];

// Pairs: can't pick both sides of the same axis
const EXCLUSIVE_PAIRS = [
  ['hp_up',      'hp_down'],
  ['armor_up',   'armor_down'],
  ['speed_up',   'speed_down'],
  ['ammo_up',    'ammo_down'],
  ['drop_up',    'drop_down'],
  ['ammodrop_up','ammodrop_down'],
  ['regen_up',   'regen_down'],
];

// ── LoadoutSelect ─────────────────────────────────────────────────────────────

export class LoadoutSelect {
  constructor() {
    this._el = document.getElementById('loadout-select');
    this._reset();
  }

  _reset() {
    this._weapons  = new Set(); // max 2
    this._activeId = LOADOUT_ACTIVES[0].id; // auto-selected
    this._passives = new Set();
  }

  // onBack()  — user presses BACK
  // onStart(charDef, dropMods) — user confirms loadout
  show(onBack, onStart) {
    this._onBack  = onBack;
    this._onStart = onStart;
    this._reset();
    this._buildUI();
    this._el.classList.remove('hidden');
  }

  hide() {
    this._el.classList.add('hidden');
  }

  // ── Budget ───────────────────────────────────────────────────────────────────

  _calcSpent() {
    const activeCost = LOADOUT_ACTIVES.find(a => a.id === this._activeId)?.cost ?? 1;
    let spent = this._weapons.size + activeCost; // weapons + active skill
    for (const pid of this._passives) {
      const p = LOADOUT_PASSIVES.find(x => x.id === pid);
      if (p) spent += p.cost;
    }
    return spent;
  }

  _remaining() { return BUDGET_MAX - this._calcSpent(); }

  // ── UI Build ─────────────────────────────────────────────────────────────────

  _buildUI() {
    this._el.innerHTML = `
      <div id="lo-header">
        <h1>LOADOUT BUILDER</h1>
        <div id="lo-budget-row">
          <span id="lo-budget-label">BUDGET</span>
          <div id="lo-budget-bar"><div id="lo-budget-fill"></div></div>
          <span id="lo-budget-num"></span>
        </div>
      </div>
      <div id="lo-body">
        <div class="lo-col" id="lo-col-weapons">
          <div class="lo-col-title">WEAPONS <span class="lo-col-sub">（選2）</span></div>
          <div id="lo-weapon-list"></div>
        </div>
        <div class="lo-col" id="lo-col-active">
          <div class="lo-col-title">ACTIVE SKILL</div>
          <div id="lo-active-list"></div>
        </div>
        <div class="lo-col lo-col-wide" id="lo-col-passives">
          <div class="lo-col-title">PASSIVE <span class="lo-col-sub">（選填）</span></div>
          <div id="lo-passive-grid">
            <div>
              <div class="lo-passive-sub">強化 <span class="lo-cost-pos">+1</span></div>
              <div id="lo-buffs"></div>
            </div>
            <div>
              <div class="lo-passive-sub">弱化 <span class="lo-cost-neg">-1</span></div>
              <div id="lo-nerfs"></div>
            </div>
          </div>
        </div>
      </div>
      <div id="lo-footer">
        <button id="lo-back-btn">← BACK</button>
        <div id="lo-status"></div>
        <button id="lo-confirm-btn" disabled>CONFIRM →</button>
      </div>
    `;

    // Weapons
    const wList = this._el.querySelector('#lo-weapon-list');
    for (const w of LOADOUT_WEAPONS) {
      const def  = WEAPON_DEFS[w.id];
      const card = this._makeCard({
        id: w.id, icon: def.shortName, name: def.name, sub: w.stat,
        cost: w.cost, group: 'weapon',
      });
      wList.appendChild(card);
    }

    // Active skill — click to select one
    const aList = this._el.querySelector('#lo-active-list');
    for (const a of LOADOUT_ACTIVES) {
      const card = this._makeCard({
        id: a.id, icon: a.icon, name: a.name, sub: a.desc,
        cost: a.cost, group: 'active',
      });
      aList.appendChild(card);
    }

    // Passives — buffs
    const buffsEl = this._el.querySelector('#lo-buffs');
    const nerfsEl = this._el.querySelector('#lo-nerfs');
    for (const p of LOADOUT_PASSIVES) {
      const card = this._makeCard({
        id: p.id, icon: p.icon, name: p.name, sub: p.desc ?? '',
        cost: p.cost, group: 'passive',
      });
      (p.cost > 0 ? buffsEl : nerfsEl).appendChild(card);
    }

    // Footer buttons
    this._el.querySelector('#lo-back-btn').addEventListener('click', () => {
      this.hide();
      this._onBack?.();
    });
    this._el.querySelector('#lo-confirm-btn').addEventListener('click', () => {
      this.hide();
      this._onStart?.(this._buildCharDef(), this._buildDropMods());
    });

    this._refreshUI();
  }

  _makeCard({ id, icon, name, sub, cost, group, autoSelected = false }) {
    const div  = document.createElement('div');
    div.className   = 'lo-card';
    div.dataset.id    = id;
    div.dataset.group = group;
    if (autoSelected) div.classList.add('lo-auto');

    const costLabel = cost > 0 ? `<span class="lo-cost-pos">+${cost}</span>`
                                : `<span class="lo-cost-neg">${cost}</span>`;
    div.innerHTML = `
      <div class="lo-card-icon">${icon}</div>
      <div class="lo-card-body">
        <div class="lo-card-name">${name}</div>
        ${sub ? `<div class="lo-card-sub">${sub}</div>` : ''}
      </div>
      <div class="lo-card-cost">${autoSelected ? '✓' : costLabel}</div>
    `;

    if (!autoSelected) {
      div.addEventListener('click', () => this._onCardClick(id, group));
    }
    return div;
  }

  // ── Click Logic ──────────────────────────────────────────────────────────────

  _onCardClick(id, group) {
    if (group === 'active') {
      this._activeId = id; // always switch — always exactly one active
    } else if (group === 'weapon') {
      if (this._weapons.has(id)) {
        this._weapons.delete(id);
      } else {
        if (this._weapons.size >= 2) {
          // Deselect the first selected weapon
          const first = this._weapons.values().next().value;
          this._weapons.delete(first);
        }
        this._weapons.add(id);
      }
    } else if (group === 'passive') {
      if (this._passives.has(id)) {
        this._passives.delete(id);
      } else {
        // Check exclusive pair — can't pick both sides
        const pairMate = this._getExclusiveMate(id);
        if (pairMate && this._passives.has(pairMate)) return; // blocked

        // Check budget — adding this passive must not go negative
        const p = LOADOUT_PASSIVES.find(x => x.id === id);
        if (p && p.cost > 0 && this._remaining() - p.cost < 0) return; // blocked

        this._passives.add(id);
      }
    }
    this._refreshUI();
  }

  _getExclusiveMate(id) {
    for (const [a, b] of EXCLUSIVE_PAIRS) {
      if (id === a) return b;
      if (id === b) return a;
    }
    return null;
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  _refreshUI() {
    const remaining = this._remaining();
    const weaponsOk = this._weapons.size === 2;

    // Budget bar
    const fill    = this._el.querySelector('#lo-budget-fill');
    const numEl   = this._el.querySelector('#lo-budget-num');
    const pct     = Math.max(0, remaining) / BUDGET_MAX * 100;
    fill.style.width = `${pct}%`;
    fill.style.background = remaining < 0 ? '#ff3333'
                          : remaining === 0 ? '#ffaa00'
                          : '#44cc88';
    numEl.textContent = `${remaining} / ${BUDGET_MAX}`;
    numEl.style.color = remaining < 0 ? '#ff4444' : '#e8d090';

    // Card selected states
    this._el.querySelectorAll('.lo-card:not(.lo-auto)').forEach(card => {
      const id    = card.dataset.id;
      const group = card.dataset.group;
      const sel   = group === 'weapon'  ? this._weapons.has(id)
                  : group === 'passive' ? this._passives.has(id)
                  : group === 'active'  ? this._activeId === id
                  : false;
      card.classList.toggle('lo-selected', sel);

      // Dim unavailable passive cards
      if (group === 'passive') {
        const p    = LOADOUT_PASSIVES.find(x => x.id === id);
        const mate = this._getExclusiveMate(id);
        const blocked = (mate && this._passives.has(mate))
                     || (!sel && p.cost > 0 && this._remaining() - p.cost < 0);
        card.classList.toggle('lo-blocked', blocked);
      }
    });

    // Status line
    const status = this._el.querySelector('#lo-status');
    if (!weaponsOk) {
      status.textContent = `選擇武器 ${this._weapons.size} / 2`;
      status.style.color = '#ff8844';
    } else if (remaining < 0) {
      status.textContent = '超出預算！';
      status.style.color = '#ff4444';
    } else {
      status.textContent = `剩餘預算 ${remaining} 點`;
      status.style.color = '#88cc88';
    }

    // Confirm button
    this._el.querySelector('#lo-confirm-btn').disabled =
      !weaponsOk || remaining < 0;
  }

  // ── Build Result ──────────────────────────────────────────────────────────────

  _buildCharDef() {
    const stats = {
      maxHp: 100, maxArmor: 100,
      moveSpeed: 1.0,
      damageMultiplier: 1.0, reloadMultiplier: 1.0,
      hpRegen: 0, reserveMult: 1.0,
    };

    const passiveIds = [];

    for (const pid of this._passives) {
      const p = LOADOUT_PASSIVES.find(x => x.id === pid);
      if (!p) continue;
      if (p.statMod) {
        for (const [k, v] of Object.entries(p.statMod)) {
          if (k in stats) stats[k] += v;
        }
      }
      if (p.behaviorId) passiveIds.push(p.behaviorId);
    }

    // Clamp to sane ranges
    stats.maxHp     = Math.max(30,  stats.maxHp);
    stats.maxArmor  = Math.max(0,   stats.maxArmor);
    stats.moveSpeed = Math.max(0.5, stats.moveSpeed);

    const activeDef = LOADOUT_ACTIVES.find(a => a.id === this._activeId);

    return {
      id:   'loadout',
      name: 'CUSTOM',
      baseStats: stats,
      // New: array of behavior passive ids (checked via player._hasPassive)
      passiveIds,
      // Legacy compat: single passive field (first entry or none)
      passive: { id: passiveIds[0] ?? 'none', name: '' },
      activeSkill: activeDef ? {
        id:          activeDef.id,
        name:        activeDef.name,
        cooldown:    activeDef.cooldown,
        description: activeDef.desc,
      } : null,
      startingWeapons: Array.from(this._weapons),
      startArmor: 0,  // Quake-style — no starting armor
    };
  }

  _buildDropMods() {
    const mods = {};
    for (const pid of this._passives) {
      const p = LOADOUT_PASSIVES.find(x => x.id === pid);
      if (!p?.dropMod) continue;
      for (const [k, v] of Object.entries(p.dropMod)) {
        mods[k] = (mods[k] ?? 0) + v;
      }
    }
    return Object.keys(mods).length > 0 ? mods : null;
  }
}

// Re-export data so external code can reference it if needed
export { LOADOUT_PASSIVES, LOADOUT_ACTIVES, LOADOUT_WEAPONS };
