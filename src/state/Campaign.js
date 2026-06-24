import { Tuning } from './Tuning.js';
import { DeckLibrary } from './DeckLibrary.js';

// Campaign: state of the current run. Persists to localStorage. Initialized
// from Tuning + the deck tagged `player_starting` on newRun().
//
// `collection` is the master inventory (every card the player owns). `activeDeck`
// is the subset chosen for the next battle. Both are flat lists of card ids
// with duplicates rather than [id, count] pairs, since attrition removes
// individual copies.

const STORAGE_KEY = 'dtcg.campaign.v1';

export const NODE_IDS = ['ashroad', 'emberhide', 'black_rival', 'boss'];

let state = null;

function freshState() {
  return null;  // no active campaign yet
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
  if (state === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function initCampaign() {
  if (state !== null) return;
  state = load() ?? freshState();
}

function expandDeckCards(deck) {
  // Deck stores cards as [[id, count], ...]. Expand into a flat list.
  const out = [];
  for (const [id, count] of (deck?.cards ?? [])) {
    for (let i = 0; i < count; i++) out.push(id);
  }
  return out;
}

function removeFirst(arr, item) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}

export const Campaign = {
  hasActive() { return state !== null; },
  all() { return state; },

  // Start a fresh run from Tuning + the player_starting tagged deck. Returns
  // false if no deck is tagged player_starting (caller should warn).
  newRun() {
    const tuning = Tuning.all();
    const starter = DeckLibrary.getByTag('player_starting');
    if (!starter) {
      state = null;
      save();
      return false;
    }
    const cardIds = expandDeckCards(starter);
    state = {
      life: tuning.player.startingLife,
      gold: tuning.player.startingGold,
      collection: [...cardIds],
      activeDeck: [...cardIds],
      cleared: Object.fromEntries(NODE_IDS.map(id => [id, false])),
      merchantOffers: [],
      status: 'active',
      version: 1,
    };
    save();
    return true;
  },

  // Apply the outcome of a single battle.
  // params: { won, nodeId, playerFinalLife, playerGraveyardCardIds, opponentRemainingCards }
  applyBattleResult({ won, nodeId, playerFinalLife, playerGraveyardCardIds, opponentRemainingCards }) {
    if (!state) return;
    state.life = playerFinalLife;

    // Permanent attrition: graveyard cards removed from both collection and
    // active deck (one copy each, since collection allows duplicates).
    for (const id of (playerGraveyardCardIds ?? [])) {
      removeFirst(state.collection, id);
      removeFirst(state.activeDeck, id);
    }

    if (won) {
      if (state.cleared.hasOwnProperty(nodeId)) state.cleared[nodeId] = true;
      const tuning = Tuning.all();
      if (tuning.rewards?.lootRemainingDeck) {
        state.collection.push(...(opponentRemainingCards ?? []));
      }
      const goldReward = tuning.rewards?.[nodeId]?.gold ?? 0;
      state.gold += goldReward;
      if (nodeId === 'boss') {
        state.status = 'victorious';
      }
      // Merchant inventory refresh hook lives in PR 3.
    } else {
      state.status = 'dead';
    }

    save();
  },

  setActiveDeck(cardIds) {
    if (!state) return;
    state.activeDeck = [...cardIds];
    save();
  },

  setMerchantOffers(offers) {
    if (!state) return;
    state.merchantOffers = offers;
    save();
  },

  // Hard wipe — call when starting a fresh run from a terminal state.
  abandonRun() {
    state = null;
    save();
  },
};
