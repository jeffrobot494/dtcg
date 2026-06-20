import { Card } from '../cards/Card.js';
import { getCardDef } from '../cards/data/index.js';

export const DeckLoader = {
  // Expands a deck definition into a flat array of Card instances owned by `player`.
  load(deckDef, player) {
    const cards = [];
    for (const [cardId, count] of deckDef.cards) {
      const def = getCardDef(cardId);
      for (let i = 0; i < count; i++) {
        cards.push(new Card(def, player));
      }
    }
    return cards;
  },
};
