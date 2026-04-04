// BossBar — Dark Souls-style boss health bar shown at the top of the screen.
//
// Animation sequence:
//   show()  → track expands from center outward (0.55s)
//           → fill slides in from left to 100% (0.35s)
//           → switches to live HP tracking mode
//   setHp() → updates fill width smoothly in real time
//   hide()  → entire bar fades out (1s)

export class BossBar {
  constructor() {
    this._wrap  = document.getElementById('boss-bar-wrap');
    this._name  = document.getElementById('boss-bar-name');
    this._track = document.getElementById('boss-bar-track');
    this._fill  = document.getElementById('boss-bar-fill');
    this._active = false;
    this._ready  = false;
  }

  get isActive() { return this._active; }

  // bossName — display name shown above the bar
  show(bossName) {
    this._active = true;
    this._ready  = false;

    this._name.textContent = bossName;

    // Reset to hidden state instantly (no transition yet)
    this._wrap.style.transition  = 'none';
    this._wrap.style.opacity     = '0';
    this._track.style.transition = 'none';
    this._track.style.transform  = 'scaleX(0)';
    this._fill.style.transition  = 'none';
    this._fill.style.width       = '0%';
    this._fill.style.background  = 'linear-gradient(90deg, #880000, #cc2200)';

    // Double-rAF so the reset styles are committed before we animate
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // Fade in wrapper
      this._wrap.style.transition = 'opacity 0.3s ease';
      this._wrap.style.opacity    = '1';
      // Expand track from center
      this._track.style.transition = 'transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)';
      this._track.style.transform  = 'scaleX(1)';
    }));

    // After track fully expanded: fill slides in from left
    setTimeout(() => {
      this._fill.style.transition = 'width 0.65s ease-out';
      this._fill.style.width      = '100%';
      // After fill is in: switch to live fast-update mode
      setTimeout(() => {
        this._fill.style.transition = 'width 0.10s ease-out';
        this._ready = true;
      }, 680);
    }, 920);
  }

  // pct: 0.0–1.0
  setHp(pct) {
    if (!this._ready) return;
    const clamped = Math.max(0, Math.min(1, pct));
    this._fill.style.width = `${(clamped * 100).toFixed(1)}%`;
    // Shift from orange-red toward deep red as HP drops
    const r2 = Math.round(150 + clamped * 60);
    this._fill.style.background = `linear-gradient(90deg, #880000, rgb(${r2},0,0))`;
  }

  hide() {
    this._active = false;
    this._ready  = false;
    this._wrap.style.transition = 'opacity 0.9s ease';
    this._wrap.style.opacity    = '0';
    // Reset internals after fade
    setTimeout(() => {
      this._track.style.transition = 'none';
      this._track.style.transform  = 'scaleX(0)';
      this._fill.style.width       = '100%';
    }, 950);
  }
}
