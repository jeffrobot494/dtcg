import { Campaign, getNodeIds } from '../state/Campaign.js';
import { DeckLibrary } from '../state/DeckLibrary.js';
import { Tuning } from '../state/Tuning.js';

// Campaign hub. Lists the nodes from Tuning (camp + merchant + each tuning
// node) with status and cleared markers. Click a battle node to enter
// BattleScene with a config. If no campaign is active, prompts to start one.

export class MapScene {
  constructor(root, manager) {
    this.root = root;
    this.manager = manager;
  }

  mount() {
    this.render();
  }

  unmount() {}

  render() {
    if (!Campaign.hasActive()) {
      const hasStarter = !!DeckLibrary.getByTag('player_starting');
      this.root.innerHTML = `
        <div class="map-scene">
          <h2>Black Mage Expedition</h2>
          <div class="map-empty">
            <p>No active campaign.</p>
            ${hasStarter
              ? `<button data-act="new-run">Start new run</button>`
              : `<p class="warn">Tag a deck as <code>player_starting</code> in Decks before starting a run.</p>`}
          </div>
        </div>
      `;
      this._attachEmptyHandlers();
      return;
    }

    const c = Campaign.all();
    const clearedCount = Object.values(c.cleared).filter(Boolean).length;
    const totalCount = Object.keys(c.cleared).length;
    const terminal = c.status !== 'active';

    let statusBanner = '';
    if (c.status === 'dead') {
      statusBanner = `<div class="map-banner banner-dead">You died. <button data-act="goto-gameover">View summary</button></div>`;
    } else if (c.status === 'victorious') {
      statusBanner = `<div class="map-banner banner-win">Victory! <button data-act="goto-gameover">View summary</button></div>`;
    }

    this.root.innerHTML = `
      <div class="map-scene">
        <h2>Black Mage Expedition</h2>
        <div class="map-header">
          <span>Life: <strong>${c.life}</strong></span>
          <span>Gold: <strong>${c.gold}</strong></span>
          <span>Cleared: <strong>${clearedCount} / ${totalCount}</strong></span>
          <span>Collection: <strong>${c.collection.length}</strong></span>
          <span>Active deck: <strong>${c.activeDeck.length}</strong></span>
        </div>
        ${statusBanner}

        <div class="map-nodes">
          ${this._renderNonBattleNode('camp', 'Camp', 'Edit deck, view collection, start new run', terminal)}
          ${this._renderMerchantNode()}

          <div class="map-node-group">— Sorcerors —</div>
          ${(Tuning.all()?.nodes ?? []).filter(n => !n.isBoss)
            .map(n => this._renderBattleNode(n, c, terminal)).join('')}

          ${(Tuning.all()?.nodes ?? []).some(n => n.isBoss)
            ? '<div class="map-node-group">— Final —</div>' : ''}
          ${(Tuning.all()?.nodes ?? []).filter(n => n.isBoss)
            .map(n => this._renderBattleNode(n, c, terminal)).join('')}
        </div>
      </div>
    `;
    this._attachHandlers();
  }

  _renderNonBattleNode(id, label, flavor, disabled) {
    return `
      <div class="map-node">
        <div class="map-node-label">
          <strong>${label}</strong>
          <span class="map-node-flavor">${flavor}</span>
        </div>
        <button data-act="enter-${id}" ${disabled ? 'disabled' : ''}>Enter</button>
      </div>
    `;
  }

  _renderMerchantNode() {
    return `
      <div class="map-node">
        <div class="map-node-label">
          <strong>Wandering Merchant</strong>
          <span class="map-node-flavor">Buy / sell cards. Refreshes on node clear.</span>
        </div>
        <button data-act="enter-merchant">Enter</button>
      </div>
    `;
  }

  _renderBattleNode(node, c, terminal) {
    const nodeId = node.id;
    const cleared = !!c.cleared[nodeId];
    const tagged = DeckLibrary.getByTag(nodeId);
    const playerHasDeck = c.activeDeck.length > 0;

    let actionHtml;
    if (cleared) {
      actionHtml = `<span class="map-node-cleared">✓ Cleared</span>`;
    } else if (terminal) {
      actionHtml = `<button disabled>Fight</button>`;
    } else if (!tagged) {
      actionHtml = `<button disabled>Fight</button> <small class="warn">No deck tagged <code>${nodeId}</code></small>`;
    } else if (!playerHasDeck) {
      actionHtml = `<button disabled>Fight</button> <small class="warn">Active deck empty</small>`;
    } else {
      actionHtml = `<button data-act="fight-${nodeId}">Fight</button>`;
    }

    return `
      <div class="map-node">
        <div class="map-node-label">
          <strong>${node.label || nodeId}</strong>
          <span class="map-node-flavor">${node.flavor ?? ''}</span>
        </div>
        ${actionHtml}
      </div>
    `;
  }

  _attachEmptyHandlers() {
    const newRun = this.root.querySelector('[data-act="new-run"]');
    if (newRun) {
      newRun.onclick = () => {
        if (Campaign.newRun()) this.render();
      };
    }
  }

  _attachHandlers() {
    const gotoGO = this.root.querySelector('[data-act="goto-gameover"]');
    if (gotoGO) gotoGO.onclick = () => this.manager.switchTo('gameover');

    const enterCamp = this.root.querySelector('[data-act="enter-camp"]');
    if (enterCamp) enterCamp.onclick = () => this.manager.switchTo('camp');

    const enterMerchant = this.root.querySelector('[data-act="enter-merchant"]');
    if (enterMerchant) enterMerchant.onclick = () => this.manager.switchTo('merchant');

    for (const nodeId of getNodeIds()) {
      const btn = this.root.querySelector(`[data-act="fight-${nodeId}"]`);
      if (btn) {
        btn.onclick = () => this.manager.switchTo('battle', { nodeId });
      }
    }
  }
}
