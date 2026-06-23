import { Zone } from '../cards/Zone.js';
import { DeckLoader } from '../decks/DeckLoader.js';
import { emptyPool } from './Cost.js';

export class MatchPlayer {
  constructor(name, deckDef, agent) {
    this.name = name;
    this.life = 20;
    this.agent = agent;
    this.manaPool = emptyPool();
    this.landPlayedThisTurn = false;
    this.isPlayer = true;
    // Persistent modifier: when true, this player can't gain life for the rest
    // of the game. Never reset.
    this.cantGainLifeForever = false;

    this.library = new Zone('library', this, { visibleTo: 'none', layout: 'stack' });
    this.hand = new Zone('hand', this, { visibleTo: 'owner', layout: 'row' });
    this.battlefield = new Zone('battlefield', this, { visibleTo: 'all', layout: 'row' });
    this.graveyard = new Zone('graveyard', this, { visibleTo: 'all', layout: 'stack' });
    this.exile = new Zone('exile', this, { visibleTo: 'all', layout: 'stack' });

    const cards = DeckLoader.load(deckDef, this);
    for (const c of cards) this.library.add(c);
    this.library.shuffle();
  }
}
