import { DeckLibrary } from '../state/DeckLibrary.js';
import database from '../cards/data/index.js';
import { formatCost, manaValue } from '../engine/Cost.js';
import { CardTooltip } from '../ui/CardTooltip.js';

// GUI deck editor. Click a library card to add 1 copy, right-click to remove.
// Active/opponent toggles save instantly; card/name edits go through Save.

export class DeckEditorScene {
  constructor(root, manager) {
    this.root = root;
    this.manager = manager;
    this.tooltip = new CardTooltip();

    this.selectedId = null;
    this.workingCopy = null;     // { name, cards: [[id,count]] }
    this.savedSnapshot = null;   // for change detection / discard

    // Library cards sorted: lands first, then by mana value, then by name.
    this.libraryCards = Object.values(database).sort((a, b) => {
      const aLand = a.type === 'land' ? 0 : 1;
      const bLand = b.type === 'land' ? 0 : 1;
      if (aLand !== bLand) return aLand - bLand;
      const av = manaValue(a.cost);
      const bv = manaValue(b.cost);
      if (av !== bv) return av - bv;
      return a.name.localeCompare(b.name);
    });
  }

  mount() {
    const decks = DeckLibrary.list();
    if (decks.length > 0) this._loadDeck(decks[0].id);
    this.render();
  }

  unmount() {
    this.tooltip.hide();
    this.tooltip.el.remove();
  }

  // ---------- state ----------

  _loadDeck(id) {
    const deck = DeckLibrary.get(id);
    if (!deck) return;
    this.selectedId = id;
    this.workingCopy = { name: deck.name, cards: cloneCards(deck.cards) };
    this.savedSnapshot = { name: deck.name, cards: cloneCards(deck.cards) };
  }

  _hasUnsavedChanges() {
    if (!this.workingCopy || !this.savedSnapshot) return false;
    if (this.workingCopy.name !== this.savedSnapshot.name) return true;
    const w = new Map(this.workingCopy.cards);
    const s = new Map(this.savedSnapshot.cards);
    if (w.size !== s.size) return true;
    for (const [id, count] of w) {
      if (s.get(id) !== count) return true;
    }
    return false;
  }

  _confirmDiscard() {
    if (!this._hasUnsavedChanges()) return true;
    return confirm('Discard unsaved changes?');
  }

  _addCard(cardId) {
    if (!this.workingCopy) return;
    const cards = this.workingCopy.cards;
    const entry = cards.find(([id]) => id === cardId);
    if (entry) entry[1] += 1;
    else cards.push([cardId, 1]);
    this.render();
  }

  _removeCard(cardId) {
    if (!this.workingCopy) return;
    const cards = this.workingCopy.cards;
    const i = cards.findIndex(([id]) => id === cardId);
    if (i < 0) return;
    cards[i][1] -= 1;
    if (cards[i][1] <= 0) cards.splice(i, 1);
    this.render();
  }

  _save() {
    if (!this.workingCopy || !this.selectedId) return;
    DeckLibrary.update(this.selectedId, {
      name: this.workingCopy.name,
      cards: cloneCards(this.workingCopy.cards),
    });
    this.savedSnapshot = { name: this.workingCopy.name, cards: cloneCards(this.workingCopy.cards) };
    this.render();
  }

  _discard() {
    if (!this.savedSnapshot) return;
    this.workingCopy = { name: this.savedSnapshot.name, cards: cloneCards(this.savedSnapshot.cards) };
    this.render();
  }

  _clear() {
    if (!this.workingCopy || this.workingCopy.cards.length === 0) return;
    if (!confirm('Remove all cards from this deck?')) return;
    this.workingCopy.cards = [];
    this.render();
  }

  _newDeck() {
    if (!this._confirmDiscard()) return;
    const deck = DeckLibrary.create('Untitled');
    this._loadDeck(deck.id);
    this.render();
  }

  _deleteSelected() {
    if (!this.selectedId) return;
    if (!confirm(`Delete "${this.workingCopy?.name ?? 'this deck'}"?`)) return;
    DeckLibrary.delete(this.selectedId);
    this.selectedId = null;
    this.workingCopy = null;
    this.savedSnapshot = null;
    // Auto-select another if any remain
    const decks = DeckLibrary.list();
    if (decks.length > 0) this._loadDeck(decks[0].id);
    this.render();
  }

  // ---------- rendering ----------

  render() {
    this.tooltip.hide();
    const decks = DeckLibrary.list();
    const wc = this.workingCopy;
    const unsaved = this._hasUnsavedChanges();

    this.root.innerHTML = `
      <div class="deck-editor">
        <div class="deck-list-pane">
          <div class="section-label">My decks</div>
          <div class="deck-list">${this._renderDeckList(decks)}</div>
          <div class="deck-list-actions">
            <button data-act="new-deck">+ New deck</button>
            <button data-act="delete-deck" ${this.selectedId ? '' : 'disabled'}>Delete</button>
          </div>
        </div>
        <div class="deck-edit-pane">
          ${wc ? this._renderEditPane(wc, unsaved) : '<div class="empty-state">No deck selected. Click "+ New deck" to make one.</div>'}
        </div>
      </div>
    `;
    this._attachHandlers();
  }

  _renderDeckList(decks) {
    if (decks.length === 0) return '<div class="hint">No decks yet.</div>';
    const activeId = DeckLibrary.getActiveId();
    const oppId = DeckLibrary.getOpponentId();
    return decks.map(d => {
      const sel = d.id === this.selectedId;
      const mark = (sel && this._hasUnsavedChanges()) ? ' *' : '';
      const pTag = d.id === activeId ? '<span class="tag tag-p">P</span>' : '';
      const oTag = d.id === oppId ? '<span class="tag tag-o">O</span>' : '';
      return `
        <div class="deck-list-item ${sel ? 'selected' : ''}" data-deck-id="${d.id}">
          <span class="deck-name">${esc(d.name)}${mark}</span>
          <span class="deck-tags">${pTag}${oTag}</span>
        </div>
      `;
    }).join('');
  }

  _renderEditPane(wc, unsaved) {
    const activeId = DeckLibrary.getActiveId();
    const oppId = DeckLibrary.getOpponentId();
    const isActive = this.selectedId === activeId;
    const isOpp = this.selectedId === oppId;
    const total = wc.cards.reduce((s, [, n]) => s + n, 0);
    const countsById = new Map(wc.cards);

    return `
      <div class="edit-header">
        <div class="edit-row">
          <label>Name: <input type="text" class="deck-name-input" data-act="rename" value="${esc(wc.name)}"></label>
        </div>
        <div class="edit-row">
          <label><input type="checkbox" data-act="toggle-active" ${isActive ? 'checked' : ''}> Use as my deck</label>
          <label><input type="checkbox" data-act="toggle-opp" ${isOpp ? 'checked' : ''}> Use as opponent's deck</label>
        </div>
      </div>

      <div class="section">
        <div class="section-label">Library — click to add, right-click to remove</div>
        <div class="lib-grid">
          ${this.libraryCards.map(def => this._renderLibCard(def, countsById.get(def.id) ?? 0)).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Deck (${total} cards)${unsaved ? ' <span class="unsaved-note">— unsaved</span>' : ''}</div>
        ${this._renderDeckContents(wc.cards)}
      </div>

      <div class="edit-actions">
        <button data-act="save" ${unsaved ? '' : 'disabled'}>Save</button>
        <button data-act="discard" ${unsaved ? '' : 'disabled'}>Discard changes</button>
        <button data-act="clear" ${total > 0 ? '' : 'disabled'}>Clear all cards</button>
      </div>
    `;
  }

  _renderLibCard(def, count) {
    const cost = formatCost(def.cost);
    const stats = def.type === 'creature' ? `${def.power}/${def.toughness}` : '';
    const countBadge = count > 0 ? `<div class="lib-card-count">×${count}</div>` : '';
    return `
      <div class="card ${def.type} lib-card" data-card-id="${def.id}">
        <div class="card-name">${esc(def.name)}</div>
        ${cost ? `<div class="card-cost">${cost}</div>` : ''}
        <div class="card-type">${def.type}</div>
        ${stats ? `<div class="card-stats">${stats}</div>` : ''}
        ${countBadge}
      </div>
    `;
  }

  _renderDeckContents(cards) {
    const groups = {
      land: [], creature: [], artifact: [], enchantment: [], instant: [], sorcery: []
    };
    for (const [id, count] of cards) {
      const def = database[id];
      if (!def) continue;
      (groups[def.type] ?? (groups[def.type] = [])).push({ def, count });
    }
    for (const t in groups) {
      groups[t].sort((a, b) => {
        const ac = manaValue(a.def.cost);
        const bc = manaValue(b.def.cost);
        if (ac !== bc) return ac - bc;
        return a.def.name.localeCompare(b.def.name);
      });
    }
    const order = ['land', 'creature', 'artifact', 'enchantment', 'instant', 'sorcery'];
    const blocks = order.map(t => {
      const list = groups[t] || [];
      if (list.length === 0) return '';
      const total = list.reduce((s, x) => s + x.count, 0);
      const entries = list.map(x =>
        `<div class="deck-entry">×${x.count} ${esc(x.def.name)}</div>`
      ).join('');
      return `
        <div class="deck-group">
          <div class="group-label">${capitalize(t)}s (${total})</div>
          ${entries}
        </div>
      `;
    }).join('');
    return blocks || '<div class="hint">No cards yet — click cards in the library above.</div>';
  }

  // ---------- handlers ----------

  _attachHandlers() {
    this.root.querySelectorAll('.deck-list-item').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.deckId;
        if (id === this.selectedId) return;
        if (!this._confirmDiscard()) return;
        this._loadDeck(id);
        this.render();
      };
    });

    this.root.querySelectorAll('.lib-card').forEach(el => {
      const id = el.dataset.cardId;
      el.onclick = () => this._addCard(id);
      el.oncontextmenu = (e) => { e.preventDefault(); this._removeCard(id); };
      el.onmouseenter = () => this.tooltip.scheduleShow(el, database[id]);
      el.onmouseleave = () => this.tooltip.hide();
    });

    const get = act => this.root.querySelector(`[data-act="${act}"]`);

    get('new-deck')?.addEventListener('click', () => this._newDeck());
    get('delete-deck')?.addEventListener('click', () => this._deleteSelected());
    get('save')?.addEventListener('click', () => this._save());
    get('discard')?.addEventListener('click', () => this._discard());
    get('clear')?.addEventListener('click', () => this._clear());

    const nameInput = get('rename');
    if (nameInput) {
      nameInput.oninput = () => {
        if (this.workingCopy) this.workingCopy.name = nameInput.value;
        // Re-render the deck list to show the * mark, but don't re-render the
        // edit pane (would lose input focus).
        this.root.querySelector('.deck-list').innerHTML = this._renderDeckList(DeckLibrary.list());
        this._attachDeckListHandlers();
        // Also update the save/discard button states
        const unsaved = this._hasUnsavedChanges();
        get('save')?.toggleAttribute('disabled', !unsaved);
        get('discard')?.toggleAttribute('disabled', !unsaved);
      };
    }

    const activeBox = get('toggle-active');
    if (activeBox) {
      activeBox.onchange = () => {
        DeckLibrary.setActiveId(activeBox.checked ? this.selectedId : null);
        this.render();
      };
    }
    const oppBox = get('toggle-opp');
    if (oppBox) {
      oppBox.onchange = () => {
        DeckLibrary.setOpponentId(oppBox.checked ? this.selectedId : null);
        this.render();
      };
    }
  }

  _attachDeckListHandlers() {
    this.root.querySelectorAll('.deck-list-item').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.deckId;
        if (id === this.selectedId) return;
        if (!this._confirmDiscard()) return;
        this._loadDeck(id);
        this.render();
      };
    });
  }
}

// ---------- helpers ----------

function cloneCards(cards) {
  return cards.map(([id, n]) => [id, n]);
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
