import { isValidTarget, describeFilter } from '../engine/Targeting.js';
import { canBlock } from '../engine/Combat.js';
import { formatCost, formatPool } from '../engine/Cost.js';
import { CardTooltip } from './CardTooltip.js';

// BattleView renders the entire battle in plain HTML and routes clicks to
// whichever HumanAgent has a pending request. All decisions flow through the
// agent — the UI never mutates engine state directly.
export class BattleView {
  constructor(root, match) {
    this.root = root;
    this.match = match;
    this.selectedAttackers = new Set();
    this.selectedBlocker = null;
    this.blocks = [];
    // Hide the opponent's hand by default — flipping the toggle peeks at it.
    this.hideOpponentHand = true;

    this.tooltip = new CardTooltip();

    match.onUpdate = () => this.render();
    for (const p of match.players) {
      p.agent.onChange = () => this.render();
    }
  }

  mount() { this.render(); }

  // ---------- rendering ----------

  render() {
    this.tooltip.hide();
    const m = this.match;
    const html = [];

    if (m.gameOver) {
      html.push(`<div class="banner">Game Over — Winner: ${m.winner?.name ?? '—'}</div>`);
      html.push(this.renderLog());
      this.root.innerHTML = html.join('');
      return;
    }

    html.push(`
      <div class="phase">
        <span>Turn ${m.turn} — ${m.activePlayer.name}'s <b>${m.phase}</b> phase${m.combatStep ? ' — ' + m.combatStep : ''}</span>
        <label class="phase-toggle">
          <input type="checkbox" data-act="toggle-hide-opp-hand" ${this.hideOpponentHand ? 'checked' : ''}>
          Hide opponent's hand
        </label>
      </div>
    `);
    html.push(`<div class="layout">`);
    html.push(`<div class="board">`);
    html.push(this.renderPlayer(m.players[1]));   // opponent on top
    html.push(this.renderStack());
    html.push(this.renderPlayer(m.players[0]));   // you on bottom
    html.push(`</div>`);
    html.push(`<div class="sidebar">`);
    html.push(this.renderControls());
    html.push(this.renderLog());
    html.push(`</div>`);
    html.push(`</div>`);

    this.root.innerHTML = html.join('');
    this.attachHandlers();
  }

  renderPlayer(p) {
    const m = this.match;
    const isActive = p === m.activePlayer;
    const targetableClass = this.isPlayerTargetable(p) ? ' targetable' : '';
    return `
      <div class="player ${isActive ? 'active' : ''}">
        <div class="player-header${targetableClass}" data-player-name="${this.escape(p.name)}">
          <span>${p.name}</span>
          <span class="life">♥ ${p.life}</span>
          <span class="mana">Mana: ${formatPool(p.manaPool)}</span>
          ${isActive ? '<span style="color:#fc0">(active)</span>' : ''}
          ${p.agent.pending ? '<span style="color:#0c8">(priority)</span>' : ''}
        </div>
        ${this.renderHand(p)}
        ${this.renderBattlefield(p)}
        ${p.graveyard.size > 0 ? this.renderCardRow(`graveyard (${p.graveyard.size})`, p.graveyard.cards) : ''}
        <div class="zone-counts">
          Library: ${p.library.size}
          ${p.graveyard.size > 0 ? '' : `&nbsp;|&nbsp; Graveyard: ${p.graveyard.size}`}
          ${p.exile?.size > 0 ? `&nbsp;|&nbsp; Exile: ${p.exile.size}` : ''}
        </div>
      </div>
    `;
  }

  renderZone(player, zoneName) {
    const zone = player[zoneName];
    return this.renderCardRow(`${zoneName} (${zone.size})`, zone.cards);
  }

  // Hand renders as card backs for the opponent when the hide toggle is on.
  // Player 0 is always the human; player 1 is the AI/opponent.
  renderHand(player) {
    const cards = player.hand.cards;
    const hide = this.hideOpponentHand && player === this.match.players[1];
    if (!hide) return this.renderCardRow(`hand (${cards.length})`, cards);
    const backs = cards.map(c =>
      `<div class="card card-back" data-iid="${c.iid}"></div>`
    ).join('');
    return `
      <div class="zone">
        <div class="zone-label">hand (${cards.length})</div>
        <div class="cards-row">${backs}</div>
      </div>
    `;
  }

  renderBattlefield(player) {
    const cards = player.battlefield.cards;
    const creatures = cards.filter(c => c.isCreature);
    const others    = cards.filter(c => c.isArtifact || c.isEnchantment);
    const lands     = cards.filter(c => c.isLand);
    return `
      ${this.renderCardRow(`creatures (${creatures.length})`, creatures)}
      ${this.renderCardRow(`artifacts / enchantments (${others.length})`, others)}
      ${this.renderCardRow(`lands (${lands.length})`, lands)}
    `;
  }

  renderCardRow(label, cards) {
    const rendered = cards.map(c => this.renderCard(c)).join('');
    return `
      <div class="zone">
        <div class="zone-label">${label}</div>
        <div class="cards-row">${rendered}</div>
      </div>
    `;
  }

  renderCard(card) {
    const classes = ['card', card.def.type];
    if (card.tapped) classes.push('tapped');
    if (this.selectedAttackers.has(card)) classes.push('selected');
    if (this.selectedBlocker === card) classes.push('selected');
    if (this.blocks.some(b => b.blocker === card)) classes.push('selected');
    if (this.isCardTargetable(card)) classes.push('targetable');

    const parts = [];
    parts.push(`<div class="card-name">${this.escape(card.name)}</div>`);
    parts.push(this._renderCostLine(card));
    parts.push(`<div class="card-type">${card.def.type}</div>`);
    if (card.isCreature) {
      let stats = `${card.power}/${card.toughness}`;
      if (card.damage) stats += ` <span class="card-damage">(-${card.damage})</span>`;
      parts.push(`<div class="card-stats">${stats}</div>`);
      if (card.summoningSick) parts.push(`<div class="card-sick">summoning sick</div>`);
    }
    if (card.def.keywords?.length) {
      parts.push(`<div class="card-keywords">${card.def.keywords.join(', ')}</div>`);
    }
    if (card.attachedTo) {
      parts.push(`<div class="card-attached">→ ${this.escape(card.attachedTo.name)}</div>`);
    }
    if (card.regenerationShields > 0) {
      parts.push(`<div class="card-regen">regen ×${card.regenerationShields}</div>`);
    }
    const combatTag = this._combatAnnotation(card);
    if (combatTag) parts.push(combatTag);
    return `<div class="${classes.join(' ')}" data-iid="${card.iid}">${parts.join('')}</div>`;
  }

  _combatAnnotation(card) {
    const m = this.match;
    const attackers = m.currentAttackers ?? [];
    const blocks = m.currentBlocks ?? [];
    if (attackers.includes(card)) {
      const myBlockers = blocks.filter(b => b.attacker === card).map(b => b.blocker.name);
      if (myBlockers.length > 0) {
        return `<div class="card-combat">attacking · blocked by ${myBlockers.map(n => this.escape(n)).join(', ')}</div>`;
      }
      return `<div class="card-combat">attacking</div>`;
    }
    const blocking = blocks.find(b => b.blocker === card);
    if (blocking) {
      return `<div class="card-combat">blocking ${this.escape(blocking.attacker.name)}</div>`;
    }
    return '';
  }

  renderStack() {
    const m = this.match;
    if (m.stack.isEmpty) return '';
    const top = m.stack.items.length - 1;
    // Render top-of-stack first (it resolves first).
    const items = m.stack.items.map((item, i) => {
      const targetsTxt = item.targets
        .flat()
        .filter(t => t != null)
        .map(t => t.name)
        .join(', ');
      const arrow = targetsTxt ? ` → ${this.escape(targetsTxt)}` : '';
      const isTop = i === top;
      const xLabel = item.x ? ` {X=${item.x}}` : '';
      const isAbility = item.type === 'triggered_ability' || item.type === 'activated_ability';
      const label = isAbility
        ? `${this.escape(item.source.name)}'s ability`
        : `${this.escape(item.source.name)}${xLabel}`;
      const tag = item.type === 'triggered_ability'
        ? '<span class="stack-tag tag-trigger">TRIGGER</span> '
        : item.type === 'activated_ability'
        ? '<span class="stack-tag tag-ability">ABILITY</span> '
        : '';
      return `
        <div class="stack-item${isTop ? ' top' : ''}">
          ${tag}<span class="stack-card">${label}</span>
          <span class="stack-by">by ${this.escape(item.controller.name)}</span>
          <span class="stack-target">${arrow}</span>
        </div>
      `;
    }).reverse().join('');  // visually: top of stack at top of panel
    return `
      <div class="stack">
        <div class="zone-label">stack (${m.stack.size}) — resolves top-down</div>
        ${items}
      </div>
    `;
  }

  renderControls() {
    const m = this.match;
    let pendingPlayer = null;
    for (const p of m.players) {
      if (p.agent.pending) { pendingPlayer = p; break; }
    }
    if (!pendingPlayer) return `<div class="controls"><em>Resolving…</em></div>`;

    const req = pendingPlayer.agent.pending;
    const header = `<h3>${this.escape(pendingPlayer.name)}: ${this.requestLabel(req)}</h3>`;
    return `<div class="controls">${header}${this.renderRequestControls(pendingPlayer, req)}</div>`;
  }

  requestLabel(req) {
    switch (req.kind) {
      case 'priority':  return 'choose an action (or pass)';
      case 'target':    return `choose ${describeFilter(req.filter)} for ${this.escape(req.source?.name ?? '')}`;
      case 'xvalue': {
        const unit = req.costKind === 'life' ? 'X life' : 'X';
        return `choose ${unit} for ${this.escape(req.card?.name ?? '')} (max ${req.max})`;
      }
      case 'attackers': return 'declare attackers';
      case 'blockers':  return 'declare blockers';
      case 'confirm-trigger': {
        const name = this.escape(req.source?.name ?? 'ability');
        const lifeCost = req.trigger?.cost?.life;
        const costText = lifeCost ? ` (pay ${lifeCost} life)` : '';
        return `use ${name}'s ability${costText}?`;
      }
      case 'discard': return 'choose a card from your hand to discard';
    }
    return req.kind;
  }

  _renderCostLine(card) {
    const text = formatCost(card.cost);
    return text ? `<div class="card-cost">cost ${text}</div>` : '';
  }

  renderRequestControls(player, req) {
    switch (req.kind) {
      case 'priority':
        return `
          <button data-act="pass">Pass</button>
          <small>
            Click cards or lands in your hand/battlefield to take actions.
            Lands &amp; creatures are sorcery-speed (your main phase, empty stack).
            Instants can be cast any time you have priority.
          </small>`;
      case 'target':
        return `
          <button data-act="cancel-target">Cancel</button>
          <small>Click a highlighted target.</small>`;
      case 'xvalue': {
        const hint = req.costKind === 'life'
          ? 'X life will be paid in addition to the mana cost.'
          : 'X mana adds to the cost.';
        return `
          <input type="number" id="x-input" min="0" max="${req.max}" value="0" style="width:60px;">
          <button data-act="confirm-x">Confirm</button>
          <button data-act="cancel-x">Cancel</button>
          <small>${hint}</small>`;
      }
      case 'attackers':
        return `
          <button data-act="confirm-attackers">Confirm attackers (${this.selectedAttackers.size})</button>
          <small>Click your untapped, non-sick creatures to toggle.</small>`;
      case 'blockers':
        return `
          <button data-act="confirm-blockers">Confirm blocks (${this.blocks.length})</button>
          <small>Click your creature, then the attacker it blocks. Click an assigned blocker to remove.</small>`;
      case 'confirm-trigger':
        return `
          <button data-act="confirm-trigger-yes">Yes</button>
          <button data-act="confirm-trigger-no">No</button>`;
      case 'discard':
        return `
          <button data-act="cancel-discard">Cancel</button>
          <small>Click a card in your hand to discard it.</small>`;
    }
    return '';
  }

  renderLog() {
    const lines = this.match.log.slice(-20).map(l => `<div>${this.escape(l)}</div>`).join('');
    return `<div class="log">${lines}</div>`;
  }

  escape(s) {
    return String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  }

  // ---------- targeting helpers ----------

  pendingTargetRequest() {
    for (const p of this.match.players) {
      if (p.agent.pending?.kind === 'target') return { player: p, req: p.agent.pending };
    }
    return null;
  }

  isCardTargetable(card) {
    const t = this.pendingTargetRequest();
    if (!t) return false;
    if (t.req.picks?.includes(card)) return false;  // already picked in multi-target
    return isValidTarget(card, t.req.filter, this.match, t.player);
  }

  isPlayerTargetable(player) {
    const t = this.pendingTargetRequest();
    if (!t) return false;
    return isValidTarget(player, t.req.filter, this.match, t.player);
  }

  // ---------- input ----------

  attachHandlers() {
    this.root.querySelectorAll('.card').forEach(el => {
      el.onclick = () => this.onCardClick(parseInt(el.dataset.iid, 10));
      // Don't surface card info on hidden cards (would leak opponent's hand).
      if (el.classList.contains('card-back')) return;
      el.onmouseenter = () => {
        const found = this.findCard(parseInt(el.dataset.iid, 10));
        if (found) this.tooltip.scheduleShow(el, found.card);
      };
      el.onmouseleave = () => this.tooltip.hide();
    });
    this.root.querySelectorAll('.player-header[data-player-name]').forEach(el => {
      el.onclick = () => this.onPlayerClick(el.dataset.playerName);
    });
    this.root.querySelectorAll('button[data-act]').forEach(el => {
      el.onclick = () => this.onButton(el.dataset.act);
    });
    const hideToggle = this.root.querySelector('[data-act="toggle-hide-opp-hand"]');
    if (hideToggle) {
      hideToggle.onchange = () => {
        this.hideOpponentHand = hideToggle.checked;
        this.render();
      };
    }
  }


  findCard(iid) {
    for (const p of this.match.players) {
      for (const zoneName of ['hand', 'battlefield', 'graveyard']) {
        for (const c of p[zoneName].cards) {
          if (c.iid === iid) return { card: c, owner: p };
        }
      }
    }
    for (const c of this.match.stackZone.cards) {
      if (c.iid === iid) return { card: c, owner: c.controller };
    }
    return null;
  }

  onCardClick(iid) {
    const found = this.findCard(iid);
    if (!found) return;
    const { card, owner } = found;
    const m = this.match;

    // Target request takes priority over other clicks.
    const targetReq = this.pendingTargetRequest();
    if (targetReq) {
      if (isValidTarget(card, targetReq.req.filter, m, targetReq.player)) {
        targetReq.player.agent.resolve(card);
      }
      return;
    }

    for (const p of m.players) {
      const req = p.agent.pending;
      if (!req) continue;
      if (req.kind === 'priority') {
        this.handlePriorityClick(card, owner, p);
        return;
      }
      if (req.kind === 'attackers' && p === m.activePlayer) {
        this.handleAttackerClick(card, owner, p);
        return;
      }
      if (req.kind === 'blockers' && p === m.nonActivePlayer) {
        this.handleBlockerClick(card, owner, p);
        return;
      }
      if (req.kind === 'discard' && card.zone === p.hand) {
        p.agent.resolve(card);
        return;
      }
    }
  }

  onPlayerClick(playerName) {
    const targetReq = this.pendingTargetRequest();
    if (!targetReq) return;
    const target = this.match.players.find(p => p.name === playerName);
    if (target && isValidTarget(target, targetReq.req.filter, this.match, targetReq.player)) {
      targetReq.player.agent.resolve(target);
    }
  }

  handlePriorityClick(card, cardOwner, actingPlayer) {
    if (cardOwner !== actingPlayer) return;
    const m = this.match;
    const isActive = actingPlayer === m.activePlayer;
    const stackEmpty = m.stack.isEmpty;
    const inMain = m.phase === 'main1' || m.phase === 'main2';
    const sorcerySpeedOk = isActive && stackEmpty && inMain;

    if (card.zone === actingPlayer.hand) {
      // canExecute uses the engine's potential-pool check, so a click on a
      // spell with untapped lands is fine — the engine auto-taps inside
      // _actionCast.
      const castable = m.canExecute(actingPlayer, { type: 'cast', card });
      if (card.isLand) {
        if (sorcerySpeedOk && !actingPlayer.landPlayedThisTurn) {
          actingPlayer.agent.resolve({ type: 'play_land', card });
        }
      } else if (castable) {
        actingPlayer.agent.resolve({ type: 'cast', card });
      }
    } else if (card.zone === actingPlayer.battlefield) {
      if (card.isLand && !card.tapped) {
        actingPlayer.agent.resolve({ type: 'tap_for_mana', card });
        return;
      }
      // Activated abilities: activate the first one the player can afford.
      const abilities = card.abilities ?? [];
      for (let i = 0; i < abilities.length; i++) {
        const ab = abilities[i];
        if (ab.kind !== 'activated') continue;
        if (m.canActivate(card, ab, actingPlayer)) {
          actingPlayer.agent.resolve({ type: 'activate', card, abilityIndex: i });
          return;
        }
      }
    } else if (card.zone === actingPlayer.graveyard) {
      // Grandmother Isa: cast a creature card from your graveyard. Engine
      // re-validates everything (Isa enabler, per-turn flag, life, hand, mana).
      if (m.canExecute(actingPlayer, { type: 'cast_from_graveyard', card })) {
        actingPlayer.agent.resolve({ type: 'cast_from_graveyard', card });
      }
    }
  }

  handleAttackerClick(card, cardOwner, actingPlayer) {
    if (cardOwner !== actingPlayer) return;
    if (!card.isCreature || card.zone !== actingPlayer.battlefield) return;
    if (card.tapped || card.summoningSick) return;
    if (this.selectedAttackers.has(card)) this.selectedAttackers.delete(card);
    else this.selectedAttackers.add(card);
    this.render();
  }

  handleBlockerClick(card, cardOwner, defender) {
    const m = this.match;
    const req = defender.agent.pending;
    if (!req) return;

    if (cardOwner === defender) {
      if (!card.isCreature || card.tapped) return;
      if (card.zone !== defender.battlefield) return;
      const idx = this.blocks.findIndex(b => b.blocker === card);
      if (idx >= 0) {
        this.blocks.splice(idx, 1);
        this.render();
        return;
      }
      this.selectedBlocker = card;
      this.render();
    } else if (cardOwner === m.activePlayer && req.attackers.includes(card)) {
      if (!this.selectedBlocker) return;
      if (!canBlock(this.selectedBlocker, card)) return;
      this.blocks.push({ attacker: card, blocker: this.selectedBlocker });
      this.selectedBlocker = null;
      this.render();
    }
  }

  onButton(act) {
    const m = this.match;
    if (act === 'pass') {
      for (const p of m.players) {
        if (p.agent.pending?.kind === 'priority') {
          p.agent.resolve({ type: 'pass' });
          return;
        }
      }
    } else if (act === 'cancel-target') {
      const t = this.pendingTargetRequest();
      if (t) t.player.agent.resolve(null);
    } else if (act === 'confirm-x') {
      const input = document.getElementById('x-input');
      const raw = parseInt(input?.value, 10);
      for (const p of m.players) {
        const req = p.agent.pending;
        if (req?.kind === 'xvalue') {
          const x = Math.max(0, Math.min(req.max, isNaN(raw) ? 0 : raw));
          p.agent.resolve(x);
          return;
        }
      }
    } else if (act === 'cancel-x') {
      for (const p of m.players) {
        if (p.agent.pending?.kind === 'xvalue') {
          p.agent.resolve(null);
          return;
        }
      }
    } else if (act === 'confirm-attackers') {
      const p = m.activePlayer;
      if (p.agent.pending?.kind === 'attackers') {
        const result = [...this.selectedAttackers];
        this.selectedAttackers.clear();
        p.agent.resolve(result);
      }
    } else if (act === 'confirm-blockers') {
      const p = m.nonActivePlayer;
      if (p.agent.pending?.kind === 'blockers') {
        const result = this.blocks;
        this.blocks = [];
        this.selectedBlocker = null;
        p.agent.resolve(result);
      }
    } else if (act === 'confirm-trigger-yes' || act === 'confirm-trigger-no') {
      const value = act === 'confirm-trigger-yes';
      for (const p of m.players) {
        if (p.agent.pending?.kind === 'confirm-trigger') {
          p.agent.resolve(value);
          return;
        }
      }
    } else if (act === 'cancel-discard') {
      for (const p of m.players) {
        if (p.agent.pending?.kind === 'discard') {
          p.agent.resolve(null);
          return;
        }
      }
    }
  }
}
