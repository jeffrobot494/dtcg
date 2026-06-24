import { loadDeck } from '../decks/parser.js';

// Singleton: holds the user's collection of decks plus which one is "mine" and
// which one is "opponent's" (for now manual; later driven by adventure state).
// Persists to localStorage. Decks stored as { id, name, cards: [[id, count]], tag }.
//
// Tags are used by the campaign layer to route decks into roles:
//   player_starting / ashroad / emberhide / black_rival / boss
// Each tag is unique — assigning a tag transfers it from any previous holder.

const STORAGE_KEY = 'dtcg.deckLibrary';

export const DECK_TAGS = [
  'player_starting',
  'ashroad',
  'emberhide',
  'black_rival',
  'boss',
];

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
    // Backfill tag field for decks saved before the tag system existed.
    for (const d of Object.values(state.decks ?? {})) {
      if (d.tag === undefined) d.tag = null;
    }
    return;
  }

  state = { decks: {}, activeId: null, opponentId: null };
  try {
    const seed = await loadDeck('decks/starter_red.txt');
    const id = freshId();
    state.decks[id] = { id, name: seed.name || 'Burn Starter', cards: seed.cards, tag: null };
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
    state.decks[id] = { id, name, cards, tag: null };
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

  // Look up a deck by role tag. Returns null if no deck has that tag.
  getByTag(tag) {
    for (const d of Object.values(state.decks)) {
      if (d.tag === tag) return d;
    }
    return null;
  },

  // Assign a role tag to a deck. Strips it from any previous holder so each
  // tag has at most one owner. Pass null/empty to clear the tag.
  setTag(id, tag) {
    if (!state.decks[id]) return;
    const normalized = tag || null;
    if (normalized && !DECK_TAGS.includes(normalized)) return;
    if (normalized) {
      for (const d of Object.values(state.decks)) {
        if (d.id !== id && d.tag === normalized) d.tag = null;
      }
    }
    state.decks[id].tag = normalized;
    save();
  },

  getActiveId()    { return state.activeId; },
  getOpponentId()  { return state.opponentId; },
  setActiveId(id)   { state.activeId = id; save(); },
  setOpponentId(id) { state.opponentId = id; save(); },
};
