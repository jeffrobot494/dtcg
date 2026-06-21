import { Match } from './engine/Match.js';
import { MatchPlayer } from './engine/MatchPlayer.js';
import { HumanAgent } from './agents/HumanAgent.js';
import { BasicAI } from './agents/BasicAI.js';
import { loadDeck } from './decks/parser.js';
import { BattleView } from './ui/BattleView.js';

const starterRed = await loadDeck('decks/starter_red.txt');

const p1 = new MatchPlayer('Player 1', starterRed, new HumanAgent());
const p2 = new MatchPlayer('Player 2', starterRed, new BasicAI());

const match = new Match([p1, p2]);
const view = new BattleView(document.getElementById('app'), match);
view.mount();

match.start();
