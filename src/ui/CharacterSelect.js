import { CHARACTERS } from '../characters.js';
import { makeCharPortraitCanvas } from '../utils/PlaceholderTextures.js';
import { SaveSystem } from '../systems/SaveSystem.js';

export class CharacterSelect {
  constructor() {
    this._el = document.getElementById('char-select');
    this._container = document.getElementById('char-cards-container');
    this._startBtn = document.getElementById('start-btn');
    this._selected = null;
  }

  show(onStart) {
    this._el.classList.remove('hidden');
    this._container.innerHTML = '';
    this._selected = CHARACTERS[0].id;

    CHARACTERS.forEach(char => {
      const portrait = makeCharPortraitCanvas(char.id);
      portrait.className = 'char-sprite';

      const card = document.createElement('div');
      card.className = 'char-card' + (char.id === this._selected ? ' selected' : '');
      card.dataset.id = char.id;

      const statsHTML = Object.entries(char.baseStats)
        .map(([k, v]) => `<span>${k.replace(/([A-Z])/g,' $1').toUpperCase()}: ${v}</span>`)
        .join('');

      const weaponsText = (char.startingWeapons ?? [char.startingWeapon])
        .map(id => id.replace(/([a-z])([A-Z])/g,'$1 $2').toUpperCase())
        .join(' / ');
      const skillText = char.activeSkill
        ? `<div class="passive" style="color:#99dd66"><strong>F — ${char.activeSkill.name}:</strong> ${char.activeSkill.description}</div>`
        : '';

      const best = SaveSystem.getBestForChar(char.id);
      const bestHTML = best
        ? `<div class="passive" style="color:#ffdd44;margin-top:6px">` +
          `★ BEST: Wave ${best.wave}  Kills ${best.kills}  Score ${best.score}</div>`
        : `<div class="passive" style="color:#444;margin-top:6px">No record yet</div>`;

      card.innerHTML = `
        <div class="char-sprite"></div>
        <h3>${char.name}</h3>
        <p>${char.description}</p>
        <div class="stats">${statsHTML}</div>
        <div class="passive"><strong>${char.passive.name}:</strong> ${char.passive.description}</div>
        ${skillText}
        <div class="passive" style="color:#ffdd88"><strong>Weapons:</strong> ${weaponsText}</div>
        ${bestHTML}
      `;
      card.querySelector('.char-sprite').replaceWith(portrait);
      portrait.className = 'char-sprite';

      card.addEventListener('click', () => {
        this._selected = char.id;
        this._container.querySelectorAll('.char-card').forEach(c =>
          c.classList.toggle('selected', c.dataset.id === char.id)
        );
      });

      this._container.appendChild(card);
    });

    this._startBtn.onclick = () => {
      this._el.classList.add('hidden');
      onStart(this._selected);
    };
  }
}
