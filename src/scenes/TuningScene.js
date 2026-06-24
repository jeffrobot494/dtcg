import { Tuning } from '../state/Tuning.js';
import { DeckLibrary } from '../state/DeckLibrary.js';

// Form scene exposing the game-wide knobs in Tuning. All inputs write to
// Tuning on blur (numbers) or change (checkboxes / dropdowns). One scrollable
// column grouped into sections.

export class TuningScene {
  constructor(root) {
    this.root = root;
  }

  mount() {
    this.render();
  }

  unmount() {}

  render() {
    const t = Tuning.all();
    const playerDeck = DeckLibrary.getByTag('player_starting');
    const playerDeckLabel = playerDeck
      ? `${esc(playerDeck.name)}`
      : '<span class="warn">no deck tagged player_starting</span>';

    this.root.innerHTML = `
      <div class="tuning-scene">
        <h2>Tuning</h2>

        ${this._section('Player start', `
          ${this._numberRow('player.startingLife', 'Starting life', t.player.startingLife)}
          ${this._numberRow('player.startingGold', 'Starting gold', t.player.startingGold)}
          <div class="tuning-row">
            <label>Starting deck:</label>
            <span>${playerDeckLabel}</span>
            <small>Edit the deck tagged <code>player_starting</code> in the Decks scene.</small>
          </div>
        `)}

        ${this._section('Sorceror rewards', `
          ${this._numberRow('rewards.ashroad.gold',     'Ashroad gold reward',     t.rewards.ashroad.gold)}
          ${this._numberRow('rewards.emberhide.gold',   'Emberhide gold reward',   t.rewards.emberhide.gold)}
          ${this._numberRow('rewards.black_rival.gold', 'Black Rival gold reward', t.rewards.black_rival.gold)}
          ${this._numberRow('rewards.boss.gold',        'Boss gold reward',        t.rewards.boss.gold)}
          ${this._checkboxRow('rewards.lootRemainingDeck',
            'Loot opponent\'s remaining deck on win', t.rewards.lootRemainingDeck)}
        `)}

        ${this._section('Boss', `
          ${this._numberRow('boss.startingLife', 'Boss starting life', t.boss.startingLife)}
          <div class="tuning-row">
            <label>Boss starting battlefield:</label>
            <input type="text" data-path="boss.startingBattlefield" value="${esc((t.boss.startingBattlefield ?? []).join(', '))}" style="width: 30em;">
            <small>Comma-separated card ids (e.g. <code>mountain, mountain, mountain</code>).</small>
          </div>
        `)}

        ${this._section('Merchant', `
          ${this._numberRow('merchant.offerCount',    'Number of offers',     t.merchant.offerCount)}
          ${this._numberRow('merchant.buyMultiplier', 'Buy multiplier (× MV)', t.merchant.buyMultiplier)}
          ${this._numberRow('merchant.buyOffset',     'Buy offset (+ flat)',   t.merchant.buyOffset)}
          ${this._numberRow('merchant.sellMultiplier','Sell multiplier (× MV)',t.merchant.sellMultiplier)}
          <div class="tuning-row">
            <label>Card pool:</label>
            <select data-path="merchant.pool">
              ${this._poolOption('all',           'All cards',      t.merchant.pool)}
              ${this._poolOption('non_red',       'Non-red',        t.merchant.pool)}
              ${this._poolOption('black_only',    'Black only',     t.merchant.pool)}
              ${this._poolOption('random_subset', 'Random subset',  t.merchant.pool)}
            </select>
          </div>
        `)}

        ${this._section('Persistence', `
          <div class="tuning-row">
            <button data-act="reset-tuning">Reset tuning to defaults</button>
            <small>Does not affect any active campaign.</small>
          </div>
          <div class="tuning-row">
            <label>Export / import tuning JSON:</label>
            <textarea data-act="json" rows="8" style="width: 100%; font-family: monospace;">${esc(Tuning.exportJSON())}</textarea>
            <button data-act="import">Import</button>
            <button data-act="refresh-export">Refresh JSON</button>
          </div>
        `)}
      </div>
    `;

    this._attachHandlers();
  }

  _section(title, body) {
    return `
      <div class="tuning-section">
        <h3>${esc(title)}</h3>
        ${body}
      </div>
    `;
  }

  _numberRow(path, label, value) {
    return `
      <div class="tuning-row">
        <label>${esc(label)}:</label>
        <input type="number" step="any" data-path="${path}" value="${value}">
      </div>
    `;
  }

  _checkboxRow(path, label, checked) {
    return `
      <div class="tuning-row">
        <label>
          <input type="checkbox" data-path="${path}" ${checked ? 'checked' : ''}>
          ${esc(label)}
        </label>
      </div>
    `;
  }

  _poolOption(value, label, current) {
    return `<option value="${value}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;
  }

  _attachHandlers() {
    this.root.querySelectorAll('input[type="number"][data-path]').forEach(el => {
      el.onblur = () => {
        const v = parseFloat(el.value);
        if (Number.isNaN(v)) return;
        Tuning.set(el.dataset.path, v);
      };
    });

    this.root.querySelectorAll('input[type="checkbox"][data-path]').forEach(el => {
      el.onchange = () => Tuning.set(el.dataset.path, el.checked);
    });

    this.root.querySelectorAll('select[data-path]').forEach(el => {
      el.onchange = () => Tuning.set(el.dataset.path, el.value);
    });

    // Boss startingBattlefield is a comma-separated string.
    const bf = this.root.querySelector('input[data-path="boss.startingBattlefield"]');
    if (bf) {
      bf.onblur = () => {
        const ids = bf.value.split(',').map(s => s.trim()).filter(Boolean);
        Tuning.set('boss.startingBattlefield', ids);
      };
    }

    const reset = this.root.querySelector('[data-act="reset-tuning"]');
    if (reset) {
      reset.onclick = () => {
        if (!confirm('Reset all tuning values to defaults?')) return;
        Tuning.resetToDefaults();
        this.render();
      };
    }

    const importBtn = this.root.querySelector('[data-act="import"]');
    if (importBtn) {
      importBtn.onclick = () => {
        const text = this.root.querySelector('[data-act="json"]').value;
        try {
          Tuning.importJSON(text);
          this.render();
        } catch (e) {
          alert('Invalid JSON: ' + e.message);
        }
      };
    }

    const refreshBtn = this.root.querySelector('[data-act="refresh-export"]');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.render();
    }
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
