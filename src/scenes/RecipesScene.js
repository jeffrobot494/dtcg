import { Tuning } from '../state/Tuning.js';
import database from '../cards/data/index.js';

// Authoring scene for crafting recipes. One row per non-creature card. The
// three number inputs write to Tuning.recipes.<id>.<component> on blur; the
// total cell updates live and turns red when total ≠ 3 (warn-only — the user
// can save any total, but 0 means "not craftable" downstream).

const COMPONENTS = [
  { id: 'leg_of_toad',  label: 'Leg of Toad'  },
  { id: 'eye_of_newt',  label: 'Eye of Newt'  },
  { id: 'unicorn_hair', label: 'Unicorn Hair' },
];

export class RecipesScene {
  constructor(root) {
    this.root = root;
  }

  mount() {
    this.render();
  }

  unmount() {}

  render() {
    const recipes = Tuning.all().recipes ?? {};
    const cards = Object.values(database)
      .filter(def => def.type !== 'creature' && !def.isToken)
      .sort((a, b) => a.name.localeCompare(b.name));

    this.root.innerHTML = `
      <div class="recipes-scene">
        <h2>Recipes</h2>
        <p class="hint">
          Component cost to craft each card. Totals other than 3 are highlighted
          but allowed. A recipe with total 0 makes the card uncraftable.
        </p>
        <table class="tuning-table">
          <thead>
            <tr>
              <th>Card</th>
              ${COMPONENTS.map(c => `<th>${esc(c.label)}</th>`).join('')}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${cards.map(def => this._renderRow(def, recipes[def.id])).join('')}
          </tbody>
        </table>
      </div>
    `;

    this._attachHandlers();
  }

  _renderRow(def, recipe) {
    const r = recipe ?? { leg_of_toad: 0, eye_of_newt: 0, unicorn_hair: 0 };
    const total = COMPONENTS.reduce((s, c) => s + (r[c.id] ?? 0), 0);
    return `
      <tr data-card-id="${esc(def.id)}">
        <td class="opp-name">${esc(def.name)}</td>
        ${COMPONENTS.map(c => `
          <td><input type="number" step="1" min="0"
                     data-component="${c.id}"
                     value="${r[c.id] ?? 0}"
                     style="width:3.5em;"></td>
        `).join('')}
        <td class="recipe-total ${total === 3 ? '' : 'warn'}" data-role="total">${total}</td>
      </tr>
    `;
  }

  _attachHandlers() {
    this.root.querySelectorAll('tr[data-card-id]').forEach(row => {
      const cardId = row.dataset.cardId;
      const inputs = row.querySelectorAll('input[data-component]');
      const totalCell = row.querySelector('[data-role="total"]');

      const recompute = () => {
        let sum = 0;
        inputs.forEach(i => { sum += parseInt(i.value, 10) || 0; });
        totalCell.textContent = String(sum);
        totalCell.classList.toggle('warn', sum !== 3);
      };

      inputs.forEach(input => {
        input.addEventListener('input', recompute);
        input.addEventListener('blur', () => {
          const v = Math.max(0, parseInt(input.value, 10) || 0);
          input.value = v;
          Tuning.set(`recipes.${cardId}.${input.dataset.component}`, v);
          recompute();
        });
      });
    });
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
