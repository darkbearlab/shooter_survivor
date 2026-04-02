// UpgradeMenu — dynamic upgrade card picker.
// Every 5 upgrades triggers a "milestone" draw that includes special passives.
// Weapon upgrades are generated from the player's current loadout.

// ── General upgrade pool ──────────────────────────────────────────────────────

const GENERAL_UPGRADES = [
  { id: 'max_hp',    name: 'Reinforce Vitals',  icon: '❤',  desc: 'Max HP +30. Restore the bonus immediately.' },
  { id: 'armor',     name: 'Heavy Plating',     icon: '🛡',  desc: 'Max Armor +35. Armor restored.' },
  { id: 'damage',    name: 'Lethal Strike',      icon: '💥',  desc: 'All weapon damage +20%.' },
  { id: 'reload',    name: 'Combat Reload',      icon: '⚡',  desc: 'Reload speed +25%.' },
  { id: 'lifesteal', name: 'Bloodthirsty',       icon: '🩸',  desc: 'Each kill restores 4 HP.' },
  { id: 'speed',     name: 'Adrenaline',         icon: '👟',  desc: 'Move speed +12%.' },
  { id: 'max_hp',    name: 'Reinforce Vitals',   icon: '❤',  desc: 'Max HP +30. Restore the bonus immediately.' }, // duplicate weight
  { id: 'armor',     name: 'Heavy Plating',      icon: '🛡',  desc: 'Max Armor +35. Armor restored.' },
];

// ── Milestone (every 5 levels) special passives ───────────────────────────────

const MILESTONE_UPGRADES = [
  {
    id: 'passive_free_shot',
    name: 'Hair Trigger',
    icon: '🎯',
    desc: 'Each shot has a 15% chance to not consume ammo.',
    unique: true,
  },
  {
    id: 'passive_explosive_rounds',
    name: 'Explosive Rounds',
    icon: '💣',
    desc: 'Bullets deal 20% splash damage in a 1.5m radius.',
    unique: true,
  },
  {
    id: 'passive_ricochet',
    name: 'Ricochet',
    icon: '🔄',
    desc: 'Hitscan shots penetrate one extra enemy.',
    unique: true,
  },
  {
    id: 'passive_vampiric_rounds',
    name: 'Vampiric Rounds',
    icon: '🧛',
    desc: 'Every hit restores 2 HP (stacks with Bloodthirsty).',
    unique: true,
  },
  {
    id: 'passive_adrenaline_rush',
    name: 'Adrenaline Rush',
    icon: '⚡',
    desc: 'Killing an enemy instantly resets your reload.',
    unique: true,
  },
  {
    id: 'passive_armor_regen',
    name: 'Nanites',
    icon: '🔧',
    desc: 'Passively regenerate 1 armor every 3 seconds.',
    unique: true,
  },
  {
    id: 'passive_last_stand',
    name: 'Last Stand',
    icon: '🔥',
    desc: 'Below 25% HP, deal 40% bonus damage.',
    unique: true,
  },
  {
    id: 'passive_double_tap',
    name: 'Double Tap',
    icon: '✌',
    desc: 'After a kill, next shot fires twice without extra ammo.',
    unique: true,
  },
];

// ── Weapon-specific stat upgrades (generated per weapon) ─────────────────────

const WEAPON_STAT_UPGRADES = [
  {
    key: 'damage',
    label: (wname) => `${wname}: Damage Up`,
    desc:  (pct)   => `Damage +${pct}%.`,
    pct:   25,
    icon:  '🔫',
  },
  {
    key: 'magSize',
    label: (wname) => `${wname}: Extended Mag`,
    desc:  (amt)   => `Magazine +${amt} rounds.`,
    amt:   (base)  => Math.max(2, Math.round(base * 0.35)),
    icon:  '📦',
  },
  {
    key: 'reloadTime',
    label: (wname) => `${wname}: Fast Loader`,
    desc:  (pct)   => `Reload time −${pct}%.`,
    pct:   20,
    icon:  '⚡',
  },
  {
    key: 'reserveAmmo',
    label: (wname) => `${wname}: Deep Pockets`,
    desc:  (amt)   => `Reserve ammo +${amt}.`,
    amt:   (base)  => Math.max(5, Math.round(base * 0.5)),
    icon:  '🎒',
  },
];

// ── UpgradeMenu ───────────────────────────────────────────────────────────────

export class UpgradeMenu {
  constructor() {
    this._el        = document.getElementById('upgrade-menu');
    this._container = document.getElementById('upgrade-cards-container');
    this._titleEl   = document.getElementById('upgrade-menu-title');
    this._onSelect  = null;
  }

  // playerState: { upgradeLevel, weapons[], weaponSlot, passives[] }
  show(onSelect, playerState = null) {
    this._onSelect = onSelect;
    const level     = playerState?.upgradeLevel ?? 1;
    const isMilestone = level % 5 === 0;
    const picks     = this._buildPool(playerState, isMilestone);

    if (this._titleEl) {
      this._titleEl.textContent = isMilestone
        ? `★ MILESTONE UPGRADE — LEVEL ${level} ★`
        : `LEVEL UP — CHOOSE AN UPGRADE`;
      this._titleEl.style.color = isMilestone ? '#ffdd44' : '#ff9944';
    }

    this._container.innerHTML = '';
    picks.forEach(upg => {
      const card = document.createElement('div');
      card.className = 'upgrade-card' + (isMilestone ? ' milestone' : '');
      card.innerHTML = `
        <div class="upgrade-icon">${upg.icon}</div>
        <h3>${upg.name}</h3>
        <p>${upg.desc}</p>
        ${upg._weaponId ? `<div class="upgrade-weapon-tag">${upg._weaponId.toUpperCase()}</div>` : ''}
      `;
      card.addEventListener('click', () => {
        this.hide();
        if (this._onSelect) this._onSelect(upg);
      });
      this._container.appendChild(card);
    });

    this._el.classList.remove('hidden');
  }

  hide() { this._el.classList.add('hidden'); }

  // ── Pool builder ────────────────────────────────────────────────────────────

  _buildPool(ps, isMilestone) {
    const picked = new Set();
    const result = [];
    const take = (pool, n) => {
      const shuffled = [...pool].filter(u => {
        if (u.unique && ps?.passives?.includes(u.id)) return false; // already owned
        return true;
      }).sort(() => Math.random() - 0.5);
      for (const u of shuffled) {
        if (result.length >= 3) break;
        if (n <= 0) break;
        if (picked.has(u.id + (u._weaponId ?? ''))) continue;
        picked.add(u.id + (u._weaponId ?? ''));
        result.push(u);
        n--;
      }
    };

    if (isMilestone) {
      // Milestone: 1 milestone special + 1 weapon upgrade + 1 general
      take(MILESTONE_UPGRADES, 1);
      if (ps?.weapons?.length) take(this._weaponUpgrades(ps), 1);
      take(GENERAL_UPGRADES, 1);
    } else {
      // Normal: 1 weapon upgrade + 2 general (or 3 general if no weapons)
      if (ps?.weapons?.length) take(this._weaponUpgrades(ps), 1);
      take(GENERAL_UPGRADES, 3);
    }

    // Pad with generals if we got fewer than 3
    if (result.length < 3) take(GENERAL_UPGRADES, 3 - result.length);

    return result.slice(0, 3);
  }

  // Generate weapon-stat upgrade cards from current loadout
  _weaponUpgrades(ps) {
    const cards = [];
    for (const w of (ps?.weapons ?? [])) {
      if (w.type === 'melee') continue;
      for (const tmpl of WEAPON_STAT_UPGRADES) {
        if (tmpl.key === 'magSize'     && w.magSize    === 0) continue;
        if (tmpl.key === 'reloadTime'  && w.magSize    === 0) continue;
        if (tmpl.key === 'reserveAmmo' && w.magSize    === 0) continue;
        const amt = tmpl.amt ? tmpl.amt(w[tmpl.key] ?? 10) : null;
        cards.push({
          id:        `weapon_${tmpl.key}_${w.id}`,
          _weaponId: w.id,
          _statKey:  tmpl.key,
          _amt:      amt,
          _pct:      tmpl.pct ?? null,
          name:      tmpl.label(w.shortName ?? w.name),
          desc:      tmpl.desc(amt ?? tmpl.pct),
          icon:      tmpl.icon,
        });
      }
    }
    return cards;
  }
}
