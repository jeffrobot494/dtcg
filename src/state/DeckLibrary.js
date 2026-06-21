import { loadDeck } from '../decks/parser.js';

// Singleton: holds the user's collection of decks plus which one is "mine" and
// which one is "opponent's" (for now manual; later driven by adventure state).
// Persists to localStorage. Decks stored as { id, name, cards: [[id, count]] }.

const STORAGE_KEY = 'dtcg.deckLibrary';

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
  if (state) return;

  state = { decks: {}, activeId: null, opponentId: null };
  try {
    const seed = await loadDeck('decks/starter_red.txt');
    const id = freshId();
    state.decks[id] = { id, name: seed.name || 'Burn Starter', cards: seed.cards };
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
    state.decks[id] = { id, name, cards };
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

  getActiveId()    { return state.activeId; },
  getOpponentId()  { return state.opponentId; },
  setActiveId(id)   { state.activeId = id; save(); },
  setOpponentId(id) { state.opponentId = id; save(); },
};
