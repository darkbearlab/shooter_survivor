// MapSelect — shown after character select, before startGame.
// Lets the player choose between the default arena and a custom JSON map.

export class MapSelect {
  constructor() {
    this._el          = document.getElementById('map-select');
    this._cardDefault = document.getElementById('map-card-default');
    this._cardCustom  = document.getElementById('map-card-custom');
    this._fileHint    = document.getElementById('map-card-file-hint');
    this._backBtn     = document.getElementById('map-back-btn');
    this._loadBtn     = document.getElementById('map-load-btn');
    this._startBtn    = document.getElementById('map-start-btn');
    this._mapData     = null;   // null = default arena
    this._selected    = 'default';
  }

  // onBack(): go back to char select
  // onStart(mapData): null → default arena, object → custom map
  show(onBack, onStart) {
    this._el.classList.remove('hidden');
    this._mapData  = null;
    this._selected = 'default';
    this._syncCards();

    this._cardDefault.onclick = () => {
      this._selected = 'default';
      this._syncCards();
    };

    this._cardCustom.onclick = () => {
      this._selected = 'custom';
      this._syncCards();
    };

    this._loadBtn.onclick = () => {
      const input  = document.createElement('input');
      input.type   = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            // Basic validation
            if (typeof data.width !== 'number' || typeof data.depth !== 'number') {
              throw new Error('Not a valid map file (missing width/depth).');
            }
            this._mapData  = data;
            this._selected = 'custom';
            this._fileHint.textContent = `✓ ${file.name}`;
            this._cardCustom.classList.add('has-file');
            const desc = document.getElementById('map-card-custom-desc');
            desc.textContent = `${data.name || 'Untitled'}\n${data.width}×${data.depth}  H:${data.wallHeight ?? 6}`;
            this._syncCards();
          } catch (err) {
            alert('Failed to load map:\n' + err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

    this._backBtn.onclick = () => {
      this._el.classList.add('hidden');
      onBack();
    };

    this._startBtn.onclick = () => {
      if (this._selected === 'custom' && !this._mapData) {
        alert('Please load a map file first, or select Default Arena.');
        return;
      }
      this._el.classList.add('hidden');
      onStart(this._selected === 'custom' ? this._mapData : null);
    };
  }

  _syncCards() {
    this._cardDefault.classList.toggle('selected', this._selected === 'default');
    this._cardCustom.classList.toggle('selected',  this._selected === 'custom');
    // Show load button only when custom is selected
    this._loadBtn.style.display = this._selected === 'custom' ? '' : 'none';
  }
}
