import { Campaign } from '../state/Campaign.js';
import { Tuning } from '../state/Tuning.js';
import database from '../cards/data/index.js';
import { formatCost } from '../engine/Cost.js';
import { CardTooltip } from '../ui/CardTooltip.js';

// Sub-scene reached from Camp. Shows a list of every non-creature card the
// player has ever owned (so any duplicate from the collection counts too) for
// which Tuning has a recipe with total > 0. Each row shows the recipe, current
// affordability, and a [Craft] button.
//
// Crafting is dispatched through Campaign.craftCard, which handles validation
// and component deduction.

const COMPONENTS = [
  { id: 'leg_of_toad',  label: 'Leg of Toad'  },
  { id: 'eye_of_newt',  label: 'Eye of Newt'  },
  { id: 'unicorn_hair', label: 'Unicorn Hair' },
];

export class CraftingScene {
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
        <div class="crafting-scene">
          <h2>Crafting</h2>
          <p>No active campaign.</p>
          <button data-act="back">Back to camp</button>
        </div>
      `;
      this._attach();
      return;
    }

    const recipes = Tuning.all().recipes ?? {};
    const craftable = c.everOwnedCardIds
      .map(id => ({ def: database[id], recipe: recipes[id] }))
      .filter(e => e.def && e.def.type !== 'creature' && !e.def.isToken)
      .filter(e => recipeTotal(e.recipe) > 0)
      .sort((a, b) => a.def.name.localeCompare(b.def.name));

    this.root.innerHTML = `
      <div class="crafting-scene">
        <h2>Crafting</h2>
        <div class="crafting-header">
          ${COMPONENTS.map(comp =>
            `<span>${esc(comp.label)}: <strong>${c.components?.[comp.id] ?? 0}</strong></span>`
          ).join('')}
          <button data-act="back">Back to camp</button>
        </div>

        ${craftable.length === 0
          ? '<div class="hint">No craftable cards. (Need a known card with a non-zero recipe.)</div>'
          : `<div class="crafting-list">${craftable.map(e => this._renderRow(e, c.components ?? {})).join('')}</div>`
        }
      </div>
    `;
    this._attach();
  }

  _renderRow({ def, recipe }, have) {
    const parts = COMPONENTS
      .filter(comp => (recipe[comp.id] ?? 0) > 0)
      .map(comp => {
        const need = recipe[comp.id] ?? 0;
        const got  = have[comp.id] ?? 0;
        const ok = got >= need;
        return `<span class="${ok ? 'comp-ok' : 'comp-short'}">${need} ${esc(comp.label)}</span>`;
      })
      .join(' · ');
    const affordable = COMPONENTS.every(comp => (have[comp.id] ?? 0) >= (recipe[comp.id] ?? 0));
    return `
      <div class="crafting-row" data-card-id="${esc(def.id)}">
        <div class="crafting-row-info">
          <strong>${esc(def.name)}</strong>
          <small class="crafting-meta">${esc(def.type)}${formatCost(def.cost) ? ' · ' + formatCost(def.cost) : ''}</small>
          <div class="crafting-recipe">${parts}</div>
        </div>
        <div class="crafting-row-action">
          <button data-act="craft" data-card-id="${esc(def.id)}" ${affordable ? '' : 'disabled'}>Craft</button>
        </div>
      </div>
    `;
  }

  _attach() {
    this.tooltip.hide();

    const back = this.root.querySelector('[data-act="back"]');
    if (back) back.onclick = () => this.manager.switchTo('camp');

    this.root.querySelectorAll('[data-act="craft"]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.cardId;
        if (Campaign.craftCard(id)) this.render();
      };
    });

    this.root.querySelectorAll('.crafting-row[data-card-id]').forEach(row => {
      const id = row.dataset.cardId;
      const def = database[id];
      if (!def) return;
      row.onmouseenter = () => this.tooltip.scheduleShow(row, def);
      row.onmouseleave = () => this.tooltip.hide();
    });
  }
}

function recipeTotal(recipe) {
  if (!recipe) return 0;
  return COMPONENTS.reduce((s, c) => s + (recipe[c.id] ?? 0), 0);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
