import database from '../cards/data/index.js';

// Tuning singleton: game-wide knobs editable in the TuningScene. Persists
// across runs and across browser sessions via localStorage. Independent from
// Campaign state — adjusting a knob does not wipe an active campaign.

const STORAGE_KEY = 'dtcg.tuning.v1';

// Default recipe for any non-creature card with no explicit override: three
// legs of toad (the common component). User can edit per-card on the Recipes
// scene; a recipe with total 0 means "not craftable".
const DEFAULT_RECIPE = Object.freeze({ leg_of_toad: 3, eye_of_newt: 0, unicorn_hair: 0 });

// Per-opponent component reward block, used when an opponent is defeated.
const ZERO_COMPONENTS = Object.freeze({ leg_of_toad: 0, eye_of_newt: 0, unicorn_hair: 0 });

// Default campaign nodes. The `nodes` array drives MapScene, DeckLibrary's
// tag list, BattleScene's opponent label, and Campaign.cleared. The reserved
// `player_starting` tag is added by callers — it's not a node.
const DEFAULT_NODES = [
  { id: 'ashroad',           label: 'Ashroad Pyromancer',    flavor: 'Red Burn',         isBoss: false },
  { id: 'emberhide',         label: 'Emberhide Beastmaster', flavor: 'Red Creatures',    isBoss: false },
  { id: 'black_rival',       label: 'Black Rival',           flavor: 'Black Mirror',     isBoss: false },
  { id: 'hollow_acolyte',    label: 'Hollow Acolyte',        flavor: '',                 isBoss: false },
  { id: 'veiled_hierophant', label: 'Veiled Hierophant',     flavor: '',                 isBoss: false },
  { id: 'wandering_heretic', label: 'Wandering Heretic',     flavor: '',                 isBoss: false },
  { id: 'boss',              label: 'Red Council',           flavor: '50 life, 3 Mountains in play', isBoss: true  },
];

export const DEFAULTS = Object.freeze({
  player: {
    startingLife: 20,
    startingGold: 20,
  },
  rewards: {
    lootRemainingDeck: true,
  },
  nodes: DEFAULT_NODES,
  opponents: {
    ashroad:            { gold: 10, startingLife: 20, startingBattlefield: [], components: { ...ZERO_COMPONENTS } },
    emberhide:          { gold: 10, startingLife: 20, startingBattlefield: [], components: { ...ZERO_COMPONENTS } },
    black_rival:        { gold: 15, startingLife: 20, startingBattlefield: [], components: { ...ZERO_COMPONENTS } },
    hollow_acolyte:     { gold: 10, startingLife: 20, startingBattlefield: [], components: { ...ZERO_COMPONENTS } },
    veiled_hierophant:  { gold: 10, startingLife: 20, startingBattlefield: [], components: { ...ZERO_COMPONENTS } },
    wandering_heretic:  { gold: 10, startingLife: 20, startingBattlefield: [], components: { ...ZERO_COMPONENTS } },
    boss:               { gold: 0,  startingLife: 50, startingBattlefield: ['mountain', 'mountain', 'mountain'], components: { ...ZERO_COMPONENTS } },
  },
  // Per-card crafting recipes. Auto-seeded by initTuning for any non-creature
  // card missing an entry, so newly added cards get a default recipe row.
  recipes: {},
  merchant: {
    offerCount: 5,
    buyMultiplier: 3.0,
    buyOffset: 2,
    sellMultiplier: 1.5,
    pool: 'all', // 'all' | 'non_red' | 'black_only' | 'random_subset'
  },
  rules: {
    decklessLoss: true,      // lose when you can't draw a card
    mulligansEnabled: true,  // offer London-style mulligans at game start
  },
});

let state = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target, source) {
  // Mutates target with values from source. Used to backfill new defaults onto
  // an older saved blob without dropping the user's existing edits.
  for (const k of Object.keys(source)) {
    if (target[k] && typeof target[k] === 'object' && !Array.isArray(target[k]) &&
        source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      deepMerge(target[k], source[k]);
    } else if (target[k] === undefined) {
      target[k] = source[k];
    }
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function initTuning() {
  if (state) return;
  const loaded = load();
  if (loaded) {
    state = loaded;
    // Backfill any new fields added since the saved version.
    deepMerge(state, deepClone(DEFAULTS));
  } else {
    state = deepClone(DEFAULTS);
  }
  seedRecipes();
  save();
}

// Ensure every non-creature, non-token card in the database has a recipe row.
// Idempotent; called on init and after addNode so that newly added cards
// (added to the database between sessions) get a default row.
function seedRecipes() {
  if (!state.recipes) state.recipes = {};
  for (const def of Object.values(database)) {
    if (def.type === 'creature') continue;
    if (def.isToken) continue;
    if (!state.recipes[def.id]) {
      state.recipes[def.id] = { ...DEFAULT_RECIPE };
    }
  }
}

export const Tuning = {
  // Return the full tuning blob (for the scene UI). Callers should treat it
  // as read-only and use `set` to mutate.
  all() { return state; },

  // Get a value by dot-path: Tuning.get('merchant.buyMultiplier')
  get(path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), state);
  },

  // Set a value by dot-path. Persists immediately.
  set(path, value) {
    const keys = path.split('.');
    let node = state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof node[keys[i]] !== 'object' || node[keys[i]] === null) {
        node[keys[i]] = {};
      }
      node = node[keys[i]];
    }
    node[keys[keys.length - 1]] = value;
    save();
  },

  resetToDefaults() {
    state = deepClone(DEFAULTS);
    save();
  },

  exportJSON() {
    return JSON.stringify(state, null, 2);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    state = parsed;
    deepMerge(state, deepClone(DEFAULTS));
    save();
  },

  // ---------- Node management ----------

  // Add a new node. `id` must be unique snake_case. Auto-creates a matching
  // opponents.<id> entry with sensible defaults. Returns true on success.
  addNode({ id, label, flavor = '', isBoss = false }) {
    if (!id || !/^[a-z][a-z0-9_]*$/.test(id)) return false;
    if (state.nodes.some(n => n.id === id)) return false;
    state.nodes.push({ id, label: label || id, flavor, isBoss: !!isBoss });
    if (!state.opponents[id]) {
      state.opponents[id] = {
        gold: 0,
        startingLife: isBoss ? 50 : 20,
        startingBattlefield: [],
        components: { ...ZERO_COMPONENTS },
      };
    }
    save();
    return true;
  },

  // Remove a node. Drops its opponents entry. Caller is responsible for
  // clearing any decks that were tagged with this id (DeckLibrary.clearTag).
  removeNode(id) {
    const idx = state.nodes.findIndex(n => n.id === id);
    if (idx < 0) return false;
    state.nodes.splice(idx, 1);
    delete state.opponents[id];
    save();
    return true;
  },

  // Update a node field in place (label / flavor / isBoss). Id is immutable.
  updateNode(id, patch) {
    const node = state.nodes.find(n => n.id === id);
    if (!node) return false;
    if ('label'  in patch) node.label  = patch.label;
    if ('flavor' in patch) node.flavor = patch.flavor;
    if ('isBoss' in patch) node.isBoss = !!patch.isBoss;
    save();
    return true;
  },
};
