import { Campaign } from '../state/Campaign.js';
import database from '../cards/data/index.js';

// Small switchboard reached from the Map's Camp node. Buttons for editing the
// active deck (collection mode), viewing the full collection, starting a new
// run, and going back to the map.

export class CampScene {
  constructor(root, manager) {
    this.root = root;
    this.manager = manager;
    this.showingCollection = false;
  }

  mount() {
    this.render();
  }

  unmount() {}

  render() {
    const c = Campaign.all();
    if (!c) {
      this.root.innerHTML = `
        <div class="camp-scene">
          <h2>Camp</h2>
          <p>No active campaign. Go back to the Map to start one.</p>
          <button data-act="back-to-map">Back to map</button>
        </div>
      `;
      this._attachHandlers();
      return;
    }

    this.root.innerHTML = `
      <div class="camp-scene">
        <h2>Camp</h2>
        <div class="camp-stats">
          <span>Life: <strong>${c.life}</strong></span>
          <span>Gold: <strong>${c.gold}</strong></span>
          <span>Active deck: <strong>${c.activeDeck.length}</strong> cards</span>
          <span>Collection: <strong>${c.collection.length}</strong> cards</span>
        </div>

        <div class="camp-actions">
          <button data-act="edit-deck">Edit active deck</button>
          <button data-act="toggle-collection">${this.showingCollection ? 'Hide' : 'View'} collection</button>
          <button data-act="craft">Craft</button>
          <button data-act="new-run">Start new run…</button>
          <button data-act="back-to-map">Back to map</button>
        </div>

        ${this.showingCollection ? this._renderCollection(c.collection) : ''}
      </div>
    `;
    this._attachHandlers();
  }

  _renderCollection(collection) {
    const counts = new Map();
    for (const id of collection) counts.set(id, (counts.get(id) ?? 0) + 1);
    const entries = [...counts.entries()]
      .map(([id, count]) => ({ def: database[id], count }))
      .filter(e => e.def)
      .sort((a, b) => a.def.name.localeCompare(b.def.name));
    if (entries.length === 0) return '<div class="hint">Collection is empty.</div>';
    return `
      <div class="camp-collection">
        <div class="section-label">Collection</div>
        <div class="collection-list">
          ${entries.map(e => `<div>×${e.count} ${esc(e.def.name)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  _attachHandlers() {
    const get = act => this.root.querySelector(`[data-act="${act}"]`);

    get('edit-deck')?.addEventListener('click', () => {
      this.manager.switchTo('decks', { mode: 'collection' });
    });

    get('toggle-collection')?.addEventListener('click', () => {
      this.showingCollection = !this.showingCollection;
      this.render();
    });

    get('craft')?.addEventListener('click', () => {
      this.manager.switchTo('crafting');
    });

    get('new-run')?.addEventListener('click', () => {
      if (!confirm('Abandon the current run and start fresh? This wipes your campaign state.')) return;
      if (!Campaign.newRun()) {
        alert('Tag a deck as player_starting in Decks first.');
        return;
      }
      this.manager.switchTo('map');
    });

    get('back-to-map')?.addEventListener('click', () => {
      this.manager.switchTo('map');
    });
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
