// DebugMenu — in-game cheat / test tools.
// Open/close with backtick (`). Spawns drops at map center (0, 0, 0).
// Callbacks wired by main.js after creation:
//   onSpawn(cfg)    — spawn a drop { type, weaponId?, amount? }
//   onFillAmmo()    — fill all player weapon reserves to max
//   onFullHeal()    — restore player HP and armor to max

import { WEAPON_DEFS } from '../weapons.js';

const AMMO_AMOUNTS = { shotgun: 30, rocket: 6, railgun: 15, machinegun: 60, nailgun: 30 };

export class DebugMenu {
  constructor() {
    this._el      = document.getElementById('debug-menu');
    this._built   = false;
    this._onClose = null;
    this._godBtn  = null;
    this.godMode  = false;

    // Callbacks set by main.js
    this.onSpawn    = null;
    this.onFillAmmo = null;
    this.onFullHeal = null;
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

  // ── Build UI ────────────────────────────────────────────────────────────────

  _buildUI() {
    this._el.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'bm-header';
    const title = document.createElement('h1');
    title.textContent = 'DEBUG / CHEAT';
    const hint = document.createElement('div');
    hint.className = 'bm-hint';
    hint.textContent = 'Items spawn at map center  —  ` to close';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'CLOSE [`]';
    closeBtn.className = 'bm-btn';
    closeBtn.onclick = () => this.hide();
    header.append(title, hint, closeBtn);
    this._el.appendChild(header);

    const body = document.createElement('div');
    body.className = 'bm-body debug-body';

    // ── Player section ──
    const playerSec = this._section('PLAYER');

    this._godBtn = this._btn('GOD MODE: OFF', () => this._toggleGod());
    playerSec.appendChild(this._godBtn);

    playerSec.appendChild(this._btn('FULL HP + ARMOR', () => {
      if (this.onFullHeal) this.onFullHeal();
    }));
    playerSec.appendChild(this._btn('FILL ALL AMMO', () => {
      if (this.onFillAmmo) this.onFillAmmo();
    }));

    body.appendChild(playerSec);

    // ── Consumables section ──
    const consSec = this._section('CONSUMABLES — drop at center');
    [
      { label: '+50 HP',     cfg: { type: 'health', amount: 50 } },
      { label: '+200 HP',    cfg: { type: 'health', amount: 200 } },
      { label: '+50 ARMOR',  cfg: { type: 'armor',  amount: 50 } },
      { label: '+150 ARMOR', cfg: { type: 'armor',  amount: 150 } },
    ].forEach(({ label, cfg }) => {
      consSec.appendChild(this._btn(label, () => { if (this.onSpawn) this.onSpawn(cfg); }));
    });
    body.appendChild(consSec);

    // ── Ammo section ──
    const ammoSec = this._section('AMMO — drop at center');
    for (const [id, def] of Object.entries(WEAPON_DEFS)) {
      if (def.type === 'melee') continue;
      const amt = AMMO_AMOUNTS[id] ?? 20;
      ammoSec.appendChild(this._btn(
        `${def.shortName}  ${def.name}  (+${amt})`,
        () => { if (this.onSpawn) this.onSpawn({ type: 'ammo', weaponId: id, amount: amt }); },
      ));
    }
    body.appendChild(ammoSec);

    // ── Weapon drops section ──
    const weapSec = this._section('WEAPONS — drop at center');
    for (const [id, def] of Object.entries(WEAPON_DEFS)) {
      weapSec.appendChild(this._btn(
        `${def.shortName}  ${def.name}`,
        () => { if (this.onSpawn) this.onSpawn({ type: 'weapon', weaponId: id }); },
      ));
    }
    body.appendChild(weapSec);

    this._el.appendChild(body);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _toggleGod() {
    this.godMode = !this.godMode;
    if (this._godBtn) {
      this._godBtn.textContent     = `GOD MODE: ${this.godMode ? 'ON ★' : 'OFF'}`;
      this._godBtn.style.color     = this.godMode ? '#ff4444' : '';
      this._godBtn.style.borderColor = this.godMode ? '#ff4444' : '';
    }
  }

  _section(title) {
    const sec = document.createElement('div');
    sec.className = 'bm-section';
    const h = document.createElement('div');
    h.className = 'bm-section-title';
    h.textContent = title;
    sec.appendChild(h);
    return sec;
  }

  _btn(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className   = 'bm-btn debug-item-btn';
    b.onclick     = onClick;
    return b;
  }
}
