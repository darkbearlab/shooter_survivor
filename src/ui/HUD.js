export class HUD {
  constructor() {
    this._barHp    = document.getElementById('bar-hp');
    this._barArmor = document.getElementById('bar-armor');
    this._txtHp    = document.getElementById('txt-hp');
    this._txtArmor = document.getElementById('txt-armor');
    this._wave     = document.getElementById('hud-wave');
    this._kills    = document.getElementById('hud-kills');
    this._score    = document.getElementById('hud-score');
    this._ammo     = document.getElementById('hud-ammo');
    this._weapon   = document.getElementById('hud-weapon');
    this._hitMarker = document.getElementById('hit-marker');
    this._dmgVignette = document.getElementById('damage-vignette');
    this._waveAnnounce = document.getElementById('wave-announce');
    this._comboCount = document.getElementById('combo-count');
    this._killFeed   = document.getElementById('kill-feed');
    this._pickupFeed  = document.getElementById('pickup-feed');
    this._weaponSlots = document.getElementById('weapon-slots');
    this._slotEls     = []; // cached per-slot DOM elements
    this._skillBox    = document.getElementById('hud-skill');
    this._skillLabel  = document.getElementById('skill-label');
    this._skillCdFill = document.getElementById('skill-cd-fill');
    this._skillCdText = document.getElementById('skill-cd-text');

    this._hitTimer = 0;
    this._dmgTimer = 0;
    this._announceTimer = 0;
    this._comboTimer = 0;
    this._comboStreak = 0;
  }

  show() { document.getElementById('hud').classList.remove('hidden'); }
  hide() { document.getElementById('hud').classList.add('hidden'); }

  update(dt, playerState, wave) {
    // HP bar
    const hpPct = playerState.hp / playerState.maxHp;
    this._barHp.style.width = (hpPct * 100).toFixed(1) + '%';
    this._barHp.style.background = hpPct > 0.5 ? '#44ff44' : hpPct > 0.25 ? '#ffaa00' : '#ff2222';
    this._txtHp.textContent = `${Math.ceil(playerState.hp)}/${playerState.maxHp}`;

    // Armor bar
    const arPct = playerState.maxArmor > 0 ? playerState.armor / playerState.maxArmor : 0;
    this._barArmor.style.width = (arPct * 100).toFixed(1) + '%';
    this._txtArmor.textContent = `${Math.ceil(playerState.armor)}/${playerState.maxArmor}`;

    // Ammo
    if (playerState.reloading) {
      const pct = (playerState.reloadProgress * 100).toFixed(0);
      this._ammo.textContent = `RELOADING ${pct}%`;
      this._ammo.style.color = '#888';
    } else {
      this._ammo.textContent = `${playerState.ammo} / ${playerState.reserve}`;
      this._ammo.style.color = playerState.ammo === 0 ? '#ff4444' :
                               playerState.ammo <= 2  ? '#ffaa00' : '#e8d090';
    }

    this._weapon.textContent = playerState.weaponName;
    this._weapon.style.color = playerState.nextShotDouble ? '#ffff44' : '#ff8800';

    this._wave.textContent  = wave;
    this._kills.textContent = playerState.kills;
    this._score.textContent = playerState.score;

    // Weapon slots strip
    if (playerState.weapons) this._renderWeaponSlots(playerState.weapons, playerState.weaponSlot);

    // Skill cooldown
    if (playerState.skillName && this._skillBox) {
      this._skillBox.style.display = '';
      const ready = playerState.skillCooldown <= 0;
      const pct   = ready ? 100 : (1 - playerState.skillCooldown / playerState.skillMaxCooldown) * 100;
      this._skillLabel.textContent  = `F — ${playerState.skillName}`;
      this._skillCdFill.style.width = pct.toFixed(1) + '%';
      this._skillCdFill.style.background = ready ? '#88cc44' : '#446622';
      this._skillCdText.textContent = ready ? 'READY' : playerState.skillCooldown.toFixed(1) + 's';
      this._skillCdText.style.color = ready ? '#88cc44' : '#888';
    } else if (this._skillBox) {
      this._skillBox.style.display = 'none';
    }

    // Timers
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) this._hitMarker.classList.remove('active');
    }
    if (this._dmgTimer > 0) {
      this._dmgTimer -= dt;
      if (this._dmgTimer <= 0) this._dmgVignette.classList.remove('active');
    }
    if (this._announceTimer > 0) {
      this._announceTimer -= dt;
      if (this._announceTimer <= 0) this._waveAnnounce.classList.remove('show');
    }
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) {
        this._comboCount.classList.remove('show');
        this._comboStreak = 0;
      }
    }
  }

  flashHit() {
    this._hitMarker.classList.add('active');
    this._hitTimer = 0.12;
  }

  flashDamage() {
    this._dmgVignette.classList.add('active');
    this._dmgTimer = 0.25;
  }

  showWaveAnnouncement(wave, isBoss = false) {
    const el = this._waveAnnounce;
    el.textContent = isBoss ? `⚠ BOSS WAVE ${wave}` : `WAVE ${wave}`;
    el.style.color = isBoss ? '#ff3333' : '#ff9944';
    el.classList.add('show');
    this._announceTimer = 2.5;
  }

  _renderWeaponSlots(weapons, activeSlot) {
    if (!this._weaponSlots) return;

    // Rebuild DOM if slot count changed
    if (this._slotEls.length !== weapons.length) {
      this._weaponSlots.innerHTML = '';
      this._slotEls = weapons.map((_, i) => {
        const el = document.createElement('div');
        el.className = 'wslot';
        el.innerHTML =
          `<span class="wslot-key">[${i + 1}]</span>` +
          `<span class="wslot-name"></span>` +
          `<div class="wslot-bar-bg"><div class="wslot-bar-fill"></div></div>` +
          `<span class="wslot-ammo"></span>`;
        this._weaponSlots.appendChild(el);
        return el;
      });
    }

    weapons.forEach((w, i) => {
      const el     = this._slotEls[i];
      const active = i === activeSlot;
      el.classList.toggle('active', active);

      el.querySelector('.wslot-name').textContent = w.shortName;

      // Ammo display
      const ammoEl = el.querySelector('.wslot-ammo');
      if (w.type === 'melee' || w.magSize === 0) {
        ammoEl.textContent = '∞';
        ammoEl.style.color = '#888';
      } else {
        ammoEl.textContent = `${w.ammo}/${w.reserve}`;
        ammoEl.style.color = w.ammo === 0 ? '#ff4444' : w.ammo <= 2 ? '#ffaa00' : '#aaa';
      }

      // Bar: reload progress (amber) or mag fullness (green→red)
      const fill = el.querySelector('.wslot-bar-fill');
      const pct  = Math.max(0, Math.min(1, w.reloadPct)) * 100;
      fill.style.width = pct.toFixed(1) + '%';
      if (w.reloading) {
        fill.style.background = '#ff8800';
      } else {
        fill.style.background = w.reloadPct > 0.5 ? '#44aa44'
                              : w.reloadPct > 0.2 ? '#aaaa22'
                              : '#aa2222';
      }
    });
  }

  showPickup(type, amount, weaponId) {
    if (!this._pickupFeed) return;
    const labels = {
      health: `+${amount} HP`,
      armor:  `+${amount} ARMOR`,
      ammo:   `+${amount} ${(weaponId ?? '').toUpperCase()} AMMO`,
      weapon: `NEW WEAPON`,
    };
    const colors = { health: '#ff8888', armor: '#88aaff', ammo: '#ffee66', weapon: '#88ff88' };
    const entry = document.createElement('div');
    entry.className = 'pickup-entry';
    entry.textContent = labels[type] ?? '+ PICKUP';
    entry.style.color = colors[type] ?? '#ffffff';
    this._pickupFeed.appendChild(entry);
    setTimeout(() => entry.remove(), 1500);
  }

  showKill(enemyType) {
    this._comboStreak++;
    this._comboTimer = 2.5;
    const el = this._comboCount;
    el.textContent = `×${this._comboStreak}`;
    el.classList.add('show');

    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.textContent = `+ ${enemyType.toUpperCase()} KILLED`;
    this._killFeed.appendChild(entry);
    setTimeout(() => entry.remove(), 2000);
  }
}
