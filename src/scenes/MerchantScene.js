import { Campaign } from '../state/Campaign.js';
import { Tuning } from '../state/Tuning.js';
import database from '../cards/data/index.js';
import { formatCost, manaValue } from '../engine/Cost.js';
import { CardTooltip } from '../ui/CardTooltip.js';

// Two-column merchant. Left: buy offers (from Campaign.merchantOffers).
// Right: sell pile, one row per unique cardId in your collection.
//
// Inventory only refreshes on node clear, so this scene just renders the
// current state and dispatches transactions through Campaign.

export class MerchantScene {
  constructor(root, manager) {
    this.root = root;
    this.manager = manager;
    this.tooltip = new CardTooltip();
  }

  mount() { this.render(); }

  unmount() {
    this.tooltip.hide();
    this.tooltip.el.remove();
  }

  render() {
    const c = Campaign.all();
    if (!c) {
      this.root.innerHTML = `
        <div class="merchant-scene">
          <h2>Wandering Merchant</h2>
          <p>No active campaign.</p>
          <button data-act="back">Back to map</button>
        </div>
      `;
      this._attach();
      return;
    }

    const sellMul = Tuning.all().merchant?.sellMultiplier ?? 1.5;

    this.root.innerHTML = `
      <div class="merchant-scene">
        <h2>Wandering Merchant</h2>
        <div class="merchant-header">
          <span>Gold: <strong>${c.gold}</strong></span>
          <span>Collection: <strong>${c.collection.length}</strong></span>
          <button data-act="back">Back to map</button>
        </div>

        <div class="merchant-cols">
          <div class="merchant-col">
            <div class="section-label">For sale (${c.merchantOffers.length})</div>
            ${this._renderBuyList(c.merchantOffers, c.gold)}
          </div>
          <div class="merchant-col">
            <div class="section-label">Your collection — click Sell to convert to gold</div>
            ${this._renderSellList(c.collection, sellMul)}
          </div>
        </div>
      </div>
    `;
    this._attach();
  }

  _renderBuyList(offers, gold) {
    if (offers.length === 0) {
      return '<div class="hint">Nothing for sale right now. (Refreshes after a battle.)</div>';
    }
    return `
      <div class="merchant-list">
        ${offers.map((o, i) => {
          const def = database[o.cardId];
          if (!def) return '';
          const canAfford = gold >= o.price;
          return `
            <div class="merchant-row" data-card-id="${esc(o.cardId)}">
              <div class="merchant-row-info">
                <strong>${esc(def.name)}</strong>
                <small class="merchant-meta">${esc(def.type)}${formatCost(def.cost) ? ' · ' + formatCost(def.cost) : ''}</small>
              </div>
              <div class="merchant-row-action">
                <span class="merchant-price">${o.price}g</span>
                <button data-act="buy" data-offer-index="${i}" ${canAfford ? '' : 'disabled'}>Buy</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderSellList(collection, sellMul) {
    if (collection.length === 0) {
      return '<div class="hint">Collection is empty.</div>';
    }
    const counts = new Map();
    for (const id of collection) counts.set(id, (counts.get(id) ?? 0) + 1);
    const entries = [...counts.entries()]
      .map(([id, n]) => ({ def: database[id], count: n }))
      .filter(e => e.def)
      .sort((a, b) => a.def.name.localeCompare(b.def.name));
    return `
      <div class="merchant-list">
        ${entries.map(e => {
          const mv = manaValue(e.def.cost);
          const refund = Math.max(0, Math.round(sellMul * mv));
          return `
            <div class="merchant-row" data-card-id="${esc(e.def.id)}">
              <div class="merchant-row-info">
                <strong>×${e.count} ${esc(e.def.name)}</strong>
                <small class="merchant-meta">${esc(e.def.type)}${formatCost(e.def.cost) ? ' · ' + formatCost(e.def.cost) : ''}</small>
              </div>
              <div class="merchant-row-action">
                <span class="merchant-price">+${refund}g</span>
                <button data-act="sell" data-card-id="${esc(e.def.id)}">Sell 1</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _attach() {
    this.tooltip.hide();

    const back = this.root.querySelector('[data-act="back"]');
    if (back) back.onclick = () => this.manager.switchTo('map');

    this.root.querySelectorAll('[data-act="buy"]').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.offerIndex, 10);
        if (Campaign.buyCard(idx)) this.render();
      };
    });

    this.root.querySelectorAll('[data-act="sell"]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.cardId;
        if (Campaign.sellCard(id) !== false) this.render();
      };
    });

    // Tooltips on each row (hover the row, get the card text).
    this.root.querySelectorAll('.merchant-row[data-card-id]').forEach(row => {
      const id = row.dataset.cardId;
      const def = database[id];
      if (!def) return;
      row.onmouseenter = () => this.tooltip.scheduleShow(row, def);
      row.onmouseleave = () => this.tooltip.hide();
    });
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
