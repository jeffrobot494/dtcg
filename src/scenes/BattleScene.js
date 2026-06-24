import { Match } from '../engine/Match.js';
import { MatchPlayer } from '../engine/MatchPlayer.js';
import { HumanAgent } from '../agents/HumanAgent.js';
import { BasicAI } from '../agents/BasicAI.js';
import { BattleView } from '../ui/BattleView.js';
import { DeckLibrary } from '../state/DeckLibrary.js';
import { Campaign } from '../state/Campaign.js';
import { Tuning } from '../state/Tuning.js';

// Two modes:
//   sandbox (default): uses DeckLibrary.activeId / opponentId. Same as before.
//   campaign: invoked via switchTo('battle', { nodeId }). Player deck comes
//             from Campaign.activeDeck; opponent deck from the tag matching
//             nodeId; boss gets custom life + starting battlefield from
//             Tuning. On game over, calls Campaign.applyBattleResult and
//             routes to MapScene or GameOverScene.

export class BattleScene {
  constructor(root, manager, context = {}) {
    this.root = root;
    this.manager = manager;
    this.nodeId = context.nodeId ?? null;  // campaign mode if set
    this.view = null;
    this.match = null;
    this.gameOverHandled = false;
  }

  // SceneManager guard: blocks leaving mid-battle.
  canLeave() {
    if (!this.match) return true;
    if (this.match.gameOver) return true;
    return confirm('Leaving will abandon this battle. Continue?');
  }

  async mount() {
    if (this.nodeId) {
      await this._mountCampaign();
    } else {
      await this._mountSandbox();
    }
  }

  // ---------- sandbox mode ----------

  async _mountSandbox() {
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
    this._startMatch(p1, p2);
  }

  // ---------- campaign mode ----------

  async _mountCampaign() {
    const c = Campaign.all();
    if (!c) {
      this._renderError('No active campaign.');
      return;
    }
    const opponentDeck = DeckLibrary.getByTag(this.nodeId);
    if (!opponentDeck) {
      this._renderError(`No deck tagged ${this.nodeId}. Tag one in Decks first.`);
      return;
    }
    if (c.activeDeck.length === 0) {
      this._renderError('Your active deck is empty.');
      return;
    }

    const playerDeck = { name: 'Active Deck', cards: flatToCounts(c.activeDeck) };

    // Opponent options. Boss gets custom life + starting battlefield from Tuning.
    const tuning = Tuning.all();
    const opponentOpts = {};
    if (this.nodeId === 'boss') {
      opponentOpts.startingLife = tuning.boss?.startingLife ?? 20;
      opponentOpts.startingBattlefield = tuning.boss?.startingBattlefield ?? [];
    }

    const p1 = new MatchPlayer('You', playerDeck, new HumanAgent(), { startingLife: c.life });
    const p2 = new MatchPlayer(this._opponentName(this.nodeId), opponentDeck, new BasicAI(), opponentOpts);
    this._startMatch(p1, p2);
  }

  _opponentName(nodeId) {
    switch (nodeId) {
      case 'ashroad':            return 'Ashroad Pyromancer';
      case 'emberhide':          return 'Emberhide Beastmaster';
      case 'black_rival':        return 'Black Rival';
      case 'hollow_acolyte':     return 'Hollow Acolyte';
      case 'veiled_hierophant':  return 'Veiled Hierophant';
      case 'wandering_heretic':  return 'Wandering Heretic';
      case 'boss':               return 'Red Council';
    }
    return 'Opponent';
  }

  _renderError(msg) {
    this.root.innerHTML = `
      <div class="empty-state">
        <p class="warn">${esc(msg)}</p>
        <button data-act="back-to-map">Back to map</button>
      </div>
    `;
    this.root.querySelector('[data-act="back-to-map"]')?.addEventListener('click', () => {
      this.manager.switchTo('map');
    });
  }

  // ---------- shared ----------

  _startMatch(p1, p2) {
    const rules = Tuning.all().rules ?? {};
    this.match = new Match([p1, p2], { decklessLoss: rules.decklessLoss !== false });
    this.view = new BattleView(this.root, this.match);
    this.view.mount();

    // Wrap the view's update callback with a game-over hook for campaign mode.
    const viewUpdate = this.match.onUpdate;
    this.match.onUpdate = () => {
      viewUpdate?.();
      if (this.match.gameOver && !this.gameOverHandled) {
        this.gameOverHandled = true;
        this._onGameOver();
      }
    };

    this.match.start();  // fire-and-forget; the engine awaits agent decisions
  }

  _onGameOver() {
    // Only campaign mode reports back. Sandbox just leaves the result on screen.
    if (!this.nodeId) return;

    const player = this.match.players[0];
    const opponent = this.match.players[1];
    const won = this.match.winner === player;

    const playerGraveyardCardIds = player.graveyard.cards
      .filter(c => !c.def.isToken)
      .map(c => c.def.id);
    // Loot: everything the opponent had except their graveyard. Library,
    // battlefield (including any starting-battlefield cards), and hand.
    // Tokens excluded since they cease to exist.
    const opponentRemainingCards = [
      ...opponent.library.cards,
      ...opponent.battlefield.cards,
      ...opponent.hand.cards,
    ]
      .filter(c => !c.def.isToken)
      .map(c => c.def.id);

    Campaign.applyBattleResult({
      won,
      nodeId: this.nodeId,
      playerFinalLife: Math.max(0, player.life),
      playerGraveyardCardIds,
      opponentRemainingCards,
    });

    // Brief delay so the user sees the final board state before routing.
    setTimeout(() => {
      const c = Campaign.all();
      if (c?.status === 'dead' || c?.status === 'victorious') {
        this.manager.switchTo('gameover');
      } else {
        this.manager.switchTo('map');
      }
    }, 1500);
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

// Convert a flat card-id list [id, id, id, ...] into [[id, count], ...].
function flatToCounts(ids) {
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()];
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}
