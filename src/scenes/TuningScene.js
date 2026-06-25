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

        ${this._section('Nodes', this._renderNodesSection(t.nodes ?? []))}

        ${this._section('Sorcerors',
          this._renderOpponentsTable(t.opponents ?? {})
          + `<small class="hint-inline">Starting battlefield is a comma-separated list of card ids (e.g. <code>mountain, mountain, mountain</code>). Leave empty for none.</small>`
        )}

        ${this._section('Global', `
          ${this._checkboxRow('rewards.lootRemainingDeck',
            'Loot opponent\'s remaining deck on win', t.rewards?.lootRemainingDeck !== false)}
        `)}

        ${this._section('Rules', `
          ${this._checkboxRow('rules.decklessLoss',
            'Lose when you can\'t draw a card', t.rules?.decklessLoss !== false)}
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

  // Nodes section: add/remove campaign nodes. The id is immutable after
  // creation; label/flavor/isBoss are editable inline.
  _renderNodesSection(nodes) {
    const rows = nodes.map(n => `
      <tr data-node-id="${esc(n.id)}">
        <td class="opp-name">${esc(n.id)}</td>
        <td><input type="text" data-node-field="label"  value="${esc(n.label  ?? '')}" style="width:14em;"></td>
        <td><input type="text" data-node-field="flavor" value="${esc(n.flavor ?? '')}" style="width:18em;"></td>
        <td style="text-align:center;"><input type="checkbox" data-node-field="isBoss" ${n.isBoss ? 'checked' : ''}></td>
        <td><button data-act="remove-node">Delete</button></td>
      </tr>
    `).join('');
    return `
      <table class="tuning-table">
        <thead>
          <tr><th>Id</th><th>Label</th><th>Flavor</th><th>Boss?</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="tuning-row" style="margin-top:8px;">
        <label>New node id:</label>
        <input type="text" data-act="new-node-id" placeholder="e.g. ember_witch" style="width:12em;">
        <input type="text" data-act="new-node-label" placeholder="Label" style="width:14em;">
        <button data-act="add-node">+ Add node</button>
        <small>Id: lowercase letters / digits / underscores. Adding a node creates a matching opponents entry and tag slot.</small>
      </div>
    `;
  }

  // Compact table of per-opponent knobs (starting life, gold reward, and the
  // pre-placed starting battlefield) so every node is tunable in one place.
  _renderOpponentsTable(opps) {
    const rows = Object.entries(opps).map(([id, cfg]) => `
      <tr>
        <td class="opp-name">${esc(id)}</td>
        <td><input type="number" step="1" data-path="opponents.${id}.startingLife" value="${cfg.startingLife ?? 20}" style="width:5em;"></td>
        <td><input type="number" step="1" data-path="opponents.${id}.gold"         value="${cfg.gold ?? 0}"          style="width:5em;"></td>
        <td><input type="text" data-path="opponents.${id}.startingBattlefield" data-list-input="1" value="${esc((cfg.startingBattlefield ?? []).join(', '))}" style="width:28em;"></td>
      </tr>
    `).join('');
    return `
      <table class="tuning-table">
        <thead>
          <tr><th>Node</th><th>Starting life</th><th>Gold reward</th><th>Starting battlefield</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
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

    // Starting battlefields are comma-separated lists. Per-opponent inputs
    // are marked with data-list-input so the generic number handler skips them.
    this.root.querySelectorAll('input[data-list-input="1"][data-path]').forEach(el => {
      el.onblur = () => {
        const ids = el.value.split(',').map(s => s.trim()).filter(Boolean);
        Tuning.set(el.dataset.path, ids);
      };
    });

    // Nodes: per-row label / flavor / isBoss edits.
    this.root.querySelectorAll('tr[data-node-id] input[data-node-field]').forEach(el => {
      const id = el.closest('tr').dataset.nodeId;
      const field = el.dataset.nodeField;
      const apply = () => {
        if (field === 'isBoss') Tuning.updateNode(id, { isBoss: el.checked });
        else Tuning.updateNode(id, { [field]: el.value });
      };
      if (el.type === 'checkbox') el.onchange = apply;
      else el.onblur = apply;
    });

    // Nodes: delete buttons.
    this.root.querySelectorAll('tr[data-node-id] [data-act="remove-node"]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.closest('tr').dataset.nodeId;
        if (!confirm(`Delete node "${id}"? Any deck tagged with it will be untagged.`)) return;
        Tuning.removeNode(id);
        DeckLibrary.clearTag(id);
        this.render();
      };
    });

    // Nodes: add new.
    const addBtn = this.root.querySelector('[data-act="add-node"]');
    if (addBtn) {
      addBtn.onclick = () => {
        const idEl    = this.root.querySelector('[data-act="new-node-id"]');
        const labelEl = this.root.querySelector('[data-act="new-node-label"]');
        const id = idEl?.value.trim();
        const label = labelEl?.value.trim() || id;
        if (!id) { alert('Id is required.'); return; }
        if (!Tuning.addNode({ id, label })) {
          alert('Could not add node — id must be snake_case and unique.');
          return;
        }
        this.render();
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
