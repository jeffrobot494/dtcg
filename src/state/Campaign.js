import { Tuning } from './Tuning.js';
import { DeckLibrary } from './DeckLibrary.js';
import database from '../cards/data/index.js';
import { manaValue } from '../engine/Cost.js';

// Campaign: state of the current run. Persists to localStorage. Initialized
// from Tuning + the deck tagged `player_starting` on newRun().
//
// `collection` is the master inventory (every card the player owns). `activeDeck`
// is the subset chosen for the next battle. Both are flat lists of card ids
// with duplicates rather than [id, count] pairs, since attrition removes
// individual copies.

const STORAGE_KEY = 'dtcg.campaign.v1';

export const NODE_IDS = [
  'ashroad',
  'emberhide',
  'black_rival',
  'hollow_acolyte',
  'veiled_hierophant',
  'wandering_heretic',
  'boss',
];

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
    this.regenerateMerchant();  // populate initial wares
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
      } else {
        this.regenerateMerchant();  // wares change on each node clear
      }
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

  // Build a fresh set of merchant offers from Tuning. Called on newRun and
  // after each non-boss win. Each offer is { cardId, price } and is consumed
  // on purchase (no two-for-one).
  regenerateMerchant() {
    if (!state) return;
    const t = Tuning.all().merchant ?? {};
    const offerCount = Math.max(0, Math.floor(t.offerCount ?? 5));
    const buyMul = t.buyMultiplier ?? 3;
    const buyOff = t.buyOffset ?? 2;
    const pool = merchantPool(t.pool ?? 'all');
    const shuffled = shuffle(pool);
    const offers = [];
    for (let i = 0; i < Math.min(offerCount, shuffled.length); i++) {
      const cardId = shuffled[i];
      const def = database[cardId];
      const mv = manaValue(def?.cost);
      const price = Math.max(0, Math.round(buyMul * mv + buyOff));
      offers.push({ cardId, price });
    }
    state.merchantOffers = offers;
    save();
  },

  // Purchase the offer at the given index. Removes it from the offers list
  // and adds the card to the collection. Returns true on success.
  buyCard(offerIndex) {
    if (!state) return false;
    const offer = state.merchantOffers[offerIndex];
    if (!offer) return false;
    if (state.gold < offer.price) return false;
    state.gold -= offer.price;
    state.collection.push(offer.cardId);
    state.merchantOffers.splice(offerIndex, 1);
    save();
    return true;
  },

  // Sell one copy of a card from the collection. Trims the active deck if
  // selling would leave more copies in the deck than in the collection.
  sellCard(cardId) {
    if (!state) return false;
    const i = state.collection.indexOf(cardId);
    if (i < 0) return false;
    state.collection.splice(i, 1);
    const deckCount  = state.activeDeck.filter(id => id === cardId).length;
    const collCount  = state.collection.filter(id => id === cardId).length;
    if (deckCount > collCount) removeFirst(state.activeDeck, cardId);
    const t = Tuning.all().merchant ?? {};
    const sellMul = t.sellMultiplier ?? 1.5;
    const def = database[cardId];
    const mv = manaValue(def?.cost);
    const refund = Math.max(0, Math.round(sellMul * mv));
    state.gold += refund;
    save();
    return refund;
  },

  // Hard wipe — call when starting a fresh run from a terminal state.
  abandonRun() {
    state = null;
    save();
  },
};

// ---------- merchant helpers ----------

function merchantPool(filter) {
  const out = [];
  for (const def of Object.values(database)) {
    if (def.isToken) continue;
    if (filter === 'non_red'    && def.color === 'R') continue;
    if (filter === 'black_only' && def.color !== 'B' && def.type !== 'land') continue;
    out.push(def.id);
  }
  if (filter === 'random_subset') {
    // Keep ~60% of the eligible cards each refresh so the pool itself varies.
    return shuffle(out).slice(0, Math.max(1, Math.floor(out.length * 0.6)));
  }
  return out;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
