const UPGRADE_POOL = [
  {
    id: 'max_hp',
    name: 'Strengthen Vitals',
    icon: '❤',
    desc: 'Max HP +25. Heal immediately.',
  },
  {
    id: 'armor',
    name: 'Heavy Plating',
    icon: '🛡',
    desc: 'Max Armor +30. Armor restored.',
  },
  {
    id: 'damage',
    name: 'Lethal Strike',
    icon: '🔫',
    desc: 'Damage +15%.',
  },
  {
    id: 'reload',
    name: 'Combat Reload',
    icon: '⚡',
    desc: 'Reload speed +20%.',
  },
  {
    id: 'lifesteal',
    name: 'Bloodthirsty',
    icon: '🩸',
    desc: 'Each kill restores 3 HP.',
  },
];

export class UpgradeMenu {
  constructor() {
    this._el = document.getElementById('upgrade-menu');
    this._container = document.getElementById('upgrade-cards-container');
    this._onSelect = null;
  }

  show(onSelect) {
    this._onSelect = onSelect;
    const picks = this._drawCards(3);
    this._container.innerHTML = '';

    picks.forEach(upg => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-icon">${upg.icon}</div>
        <h3>${upg.name}</h3>
        <p>${upg.desc}</p>
      `;
      card.addEventListener('click', () => {
        this.hide();
        if (this._onSelect) this._onSelect(upg.id);
      });
      this._container.appendChild(card);
    });

    this._el.classList.remove('hidden');
  }

  hide() {
    this._el.classList.add('hidden');
  }

  _drawCards(count) {
    const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
