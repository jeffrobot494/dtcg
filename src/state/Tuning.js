// Tuning singleton: game-wide knobs editable in the TuningScene. Persists
// across runs and across browser sessions via localStorage. Independent from
// Campaign state — adjusting a knob does not wipe an active campaign.

const STORAGE_KEY = 'dtcg.tuning.v1';

export const DEFAULTS = Object.freeze({
  player: {
    startingLife: 20,
    startingGold: 20,
  },
  rewards: {
    lootRemainingDeck: true,
    ashroad:            { gold: 10 },
    emberhide:          { gold: 10 },
    black_rival:        { gold: 15 },
    hollow_acolyte:     { gold: 10 },
    veiled_hierophant:  { gold: 10 },
    wandering_heretic:  { gold: 10 },
    boss:               { gold: 0 },
  },
  boss: {
    startingLife: 50,
    startingBattlefield: ['mountain', 'mountain', 'mountain'],
  },
  merchant: {
    offerCount: 5,
    buyMultiplier: 3.0,
    buyOffset: 2,
    sellMultiplier: 1.5,
    pool: 'all', // 'all' | 'non_red' | 'black_only' | 'random_subset'
  },
  rules: {
    decklessLoss: true, // lose when you can't draw a card
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
    save();
  } else {
    state = deepClone(DEFAULTS);
    save();
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
};
