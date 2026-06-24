import { Campaign } from '../state/Campaign.js';

// Terminal screen for dead / victorious campaigns. Offers a fresh run.

export class GameOverScene {
  constructor(root, manager) {
    this.root = root;
    this.manager = manager;
  }

  mount() {
    this.render();
  }

  unmount() {}

  render() {
    const c = Campaign.all();
    if (!c) {
      this.root.innerHTML = `
        <div class="gameover-scene">
          <h2>Game Over</h2>
          <p>No active campaign.</p>
          <button data-act="back-to-map">Back to map</button>
        </div>
      `;
      this._attach();
      return;
    }

    const won = c.status === 'victorious';
    const title = won ? 'Victory' : 'You Died';
    const message = won
      ? 'You destroyed the Red Council. The valley is yours.'
      : 'The valley claims another sorceror.';

    const clearedCount = Object.values(c.cleared).filter(Boolean).length;
    const totalCount = Object.keys(c.cleared).length;

    this.root.innerHTML = `
      <div class="gameover-scene">
        <h2>${title}</h2>
        <p class="gameover-message">${message}</p>
        <div class="gameover-stats">
          <div>Final life: <strong>${c.life}</strong></div>
          <div>Gold: <strong>${c.gold}</strong></div>
          <div>Nodes cleared: <strong>${clearedCount} / ${totalCount}</strong></div>
          <div>Collection size at end: <strong>${c.collection.length}</strong></div>
        </div>
        <div class="gameover-actions">
          <button data-act="new-run">Start new run</button>
          <button data-act="back-to-map">Back to map (review)</button>
        </div>
      </div>
    `;
    this._attach();
  }

  _attach() {
    const get = act => this.root.querySelector(`[data-act="${act}"]`);

    get('new-run')?.addEventListener('click', () => {
      if (!Campaign.newRun()) {
        alert('Tag a deck as player_starting in Decks first.');
        return;
      }
      this.manager.switchTo('map');
    });

    get('back-to-map')?.addEventListener('click', () => {
      this.manager.switchTo('map');
    });
  }
}
