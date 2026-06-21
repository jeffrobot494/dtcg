import { Match } from '../engine/Match.js';
import { MatchPlayer } from '../engine/MatchPlayer.js';
import { HumanAgent } from '../agents/HumanAgent.js';
import { BasicAI } from '../agents/BasicAI.js';
import { BattleView } from '../ui/BattleView.js';
import { DeckLibrary } from '../state/DeckLibrary.js';

export class BattleScene {
  constructor(root, manager) {
    this.root = root;
    this.manager = manager;
    this.view = null;
    this.match = null;
  }

  async mount() {
    const activeId = DeckLibrary.getActiveId();
    const opponentId = DeckLibrary.getOpponentId();
    const playerDeck = activeId ? DeckLibrary.get(activeId) : null;
    const opponentDeck = opponentId ? DeckLibrary.get(opponentId) : null;

    if (!playerDeck || !opponentDeck) {
      this.root.innerHTML = `
        <div class="empty-state">
          <p>You haven't picked decks yet.</p>
          <p>Go to the <b>Decks</b> tab to choose your deck and the opponent's deck.</p>
          <button data-act="goto-decks">Open Decks editor</button>
        </div>
      `;
      this.root.querySelector('[data-act="goto-decks"]')?.addEventListener('click', () => {
        this.manager.switchTo('decks');
      });
      return;
    }

    const p1 = new MatchPlayer('Player 1', playerDeck, new HumanAgent());
    const p2 = new MatchPlayer('Player 2', opponentDeck, new BasicAI());
    this.match = new Match([p1, p2]);
    this.view = new BattleView(this.root, this.match);
    this.view.mount();
    this.match.start();  // fire-and-forget; the engine awaits agent decisions
  }

  unmount() {
    // Sever the abandoned match's UI callbacks so any background tick that
    // resolves after we navigate away can't overwrite the next scene's DOM.
    if (this.match) {
      this.match.onUpdate = null;
      for (const p of this.match.players) {
        if (p.agent) p.agent.onChange = null;
      }
    }
    this.view?.tooltip?.el?.remove();
  }
}
