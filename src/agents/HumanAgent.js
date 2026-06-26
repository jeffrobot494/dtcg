import { Agent } from './Agent.js';

// HumanAgent stores a pending decision request. The UI inspects `pending` to
// know what controls to show; the UI calls resolve(value) when the user decides.
// HumanAgent itself never touches the DOM.
export class HumanAgent extends Agent {
  constructor() {
    super();
    this.pending = null;
    this.onChange = null;
  }

  _request(kind, extra = {}) {
    return new Promise(resolve => {
      this.pending = { kind, resolve, ...extra };
      this.onChange?.();
    });
  }

  resolve(value) {
    if (!this.pending) return;
    const req = this.pending;
    this.pending = null;
    this.onChange?.();
    req.resolve(value);
  }

  choosePriorityAction(match) {
    return this._request('priority');
  }

  chooseTarget(match, filter, source, effect, picks) {
    return this._request('target', { filter, source, effect, picks });
  }

  chooseXValue(match, card, max) {
    return this._request('xvalue', { card, max, source: card, costKind: card.cost?.x });
  }

  declareAttackers(match) {
    return this._request('attackers');
  }

  declareBlockers(match, attackers) {
    return this._request('blockers', { attackers });
  }

  confirmTrigger(match, source, trigger) {
    return this._request('confirm-trigger', { source, trigger });
  }

  chooseDiscard(match) {
    return this._request('discard');
  }

  chooseMulligan(match, player, mulliganCount) {
    return this._request('mulligan-decide', { player, mulliganCount });
  }

  chooseBottomCards(match, player, count) {
    return this._request('mulligan-bottom', { player, count });
  }
}
