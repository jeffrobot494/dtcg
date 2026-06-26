import { loadDeck } from '../decks/parser.js';

// Singleton: holds the user's collection of decks plus which one is "mine" and
// which one is "opponent's" (for now manual; later driven by adventure state).
// Persists to localStorage. Decks stored as { id, name, cards: [[id, count]], tags }.
//
// Tags are used by the campaign layer to route decks into roles:
//   player_starting (reserved) + each node id from Tuning.nodes.
// A deck may carry multiple tags (so one deck can serve multiple nodes). Each
// tag still belongs to at most one deck — assigning a tag strips it from any
// previous holder. The set of valid tags is dynamic (the user can add/remove
// nodes), so we don't enforce a fixed whitelist here. Callers build the
// checkbox list from Tuning + the reserved tag.

const STORAGE_KEY = 'dtcg.deckLibrary';

export const RESERVED_DECK_TAG_PLAYER = 'player_starting';

let state = null;

function freshId() {
  return Math.random().toString(36).slice(2, 10);
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

// Initializes the library. On first run, seeds with the existing
// `decks/starter_red.txt` so the user has something to play with.
export async function initDeckLibrary() {
  if (state) return;
  state = load();
  if (state) {
    // Migrate legacy single-tag decks to the multi-tag shape, and ensure
    // every deck has a tags array.
    for (const d of Object.values(state.decks ?? {})) {
      if (!Array.isArray(d.tags)) {
        d.tags = d.tag ? [d.tag] : [];
      }
      delete d.tag;
    }
    save();
    return;
  }

  state = { decks: {}, activeId: null, opponentId: null };
  try {
    const seed = await loadDeck('decks/starter_red.txt');
    const id = freshId();
    state.decks[id] = { id, name: seed.name || 'Burn Starter', cards: seed.cards, tags: [] };
    state.activeId = id;
    state.opponentId = id;
  } catch (e) {
    console.warn('No seed deck available:', e);
  }
  save();
}

export const DeckLibrary = {
  list() { return Object.values(state.decks); },
  get(id) { return state.decks[id] ?? null; },

  create(name = 'Untitled', cards = []) {
    const id = freshId();
    state.decks[id] = { id, name, cards, tags: [] };
    save();
    return state.decks[id];
  },

  update(id, patch) {
    if (!state.decks[id]) return;
    state.decks[id] = { ...state.decks[id], ...patch };
    save();
  },

  delete(id) {
    delete state.decks[id];
    if (state.activeId === id)   state.activeId = null;
    if (state.opponentId === id) state.opponentId = null;
    save();
  },

  // Look up a deck by role tag. Returns the first deck whose tags include it,
  // or null if no deck has that tag.
  getByTag(tag) {
    if (!tag) return null;
    for (const d of Object.values(state.decks)) {
      if ((d.tags ?? []).includes(tag)) return d;
    }
    return null;
  },

  // Add a role tag to a deck. Strips it from any other deck so the tag has
  // a single owner across the library. Idempotent.
  addTag(id, tag) {
    if (!state.decks[id] || !tag) return;
    for (const d of Object.values(state.decks)) {
      if (d.id === id) continue;
      d.tags = (d.tags ?? []).filter(t => t !== tag);
    }
    const tags = state.decks[id].tags ?? [];
    if (!tags.includes(tag)) tags.push(tag);
    state.decks[id].tags = tags;
    save();
  },

  // Remove a role tag from a specific deck. Idempotent.
  removeTag(id, tag) {
    if (!state.decks[id] || !tag) return;
    state.decks[id].tags = (state.decks[id].tags ?? []).filter(t => t !== tag);
    save();
  },

  // Remove a tag from every deck that has it. Used when a node is deleted
  // from Tuning so orphaned tags don't linger on the library.
  clearTag(tag) {
    if (!tag) return;
    let changed = false;
    for (const d of Object.values(state.decks)) {
      const before = d.tags ?? [];
      const after = before.filter(t => t !== tag);
      if (after.length !== before.length) {
        d.tags = after;
        changed = true;
      }
    }
    if (changed) save();
  },

  getActiveId()    { return state.activeId; },
  getOpponentId()  { return state.opponentId; },
  setActiveId(id)   { state.activeId = id; save(); },
  setOpponentId(id) { state.opponentId = id; save(); },
};
