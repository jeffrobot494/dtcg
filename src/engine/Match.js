import { Stack } from './Stack.js';
import { Zone } from '../cards/Zone.js';
import { isValidTarget } from './Targeting.js';
import { getEffect } from '../cards/effects/index.js';
import { matchesCondition, scopeForEvent } from './Triggers.js';
import { runCombatPhase } from './Combat.js';
import { canPayCost, payCost, maxXFromPool, formatCost, formatPool, emptyPool } from './Cost.js';

export class Match {
  constructor(players) {
    this.players = players;
    this.activeIndex = 0;
    this.turn = 1;
    this.phase = 'pregame';
    this.gameOver = false;
    this.winner = null;
    this.log = [];
    this.onUpdate = null;

    this.stack = new Stack();
    this.stackZone = new Zone('stack', null, { visibleTo: 'all', layout: 'stack' });
    this.combatStep = null;
    // Triggers queued by an event but not yet placed on the stack (targets
    // need to be chosen first). Drained by _processPendingTriggers.
    this._pendingTriggers = [];
  }

  get activePlayer() { return this.players[this.activeIndex]; }
  get nonActivePlayer() { return this.players[1 - this.activeIndex]; }
  opponentOf(p) { return this.players.find(q => q !== p); }

  notify(msg) {
    if (msg) this.log.push(`[T${this.turn}] ${msg}`);
    this.onUpdate?.();
  }

  async start() {
    for (const p of this.players) {
      for (let i = 0; i < 7; i++) this._drawSilent(p);
    }
    this.notify('Game start.');

    while (!this.gameOver) {
      await this.runTurn();
    }
    this.notify(`Game over. Winner: ${this.winner?.name ?? 'nobody'}.`);
  }

  async runTurn() {
    this.phase = 'untap';
    for (const c of this.activePlayer.battlefield.cards) {
      c.tapped = false;
      if (c.isCreature) c.summoningSick = false;
    }
    this.activePlayer.landPlayedThisTurn = false;
    this.notify(`--- ${this.activePlayer.name}'s turn ${this.turn} ---`);

    this.phase = 'upkeep';

    this.phase = 'draw';
    if (!(this.turn === 1 && this.activeIndex === 0)) {
      this.drawCard(this.activePlayer);
    }

    this.phase = 'main1';
    await this.priorityLoop();
    if (this.gameOver) return;

    this.phase = 'combat';
    await runCombatPhase(this);
    if (this.gameOver) return;

    this.phase = 'main2';
    await this.priorityLoop();
    if (this.gameOver) return;

    this.phase = 'end';
    for (const p of this.players) p.manaPool = emptyPool();
    // Clear "until end of turn" granted modifiers on every battlefield card.
    // Damage and tapped state are NOT cleared (damage persists per house rules;
    // tapped is cleared during the next untap step).
    for (const p of this.players) {
      for (const c of p.battlefield.cards) {
        c.grantedKeywords.clear();
        c.grantedPower = 0;
        c.grantedToughness = 0;
      }
    }

    this.activeIndex = 1 - this.activeIndex;
    if (this.activeIndex === 0) this.turn++;
  }

  // Priority alternates between players when one passes.
  // Two consecutive passes:
  //   - stack non-empty -> resolve top, active gets priority back
  //   - stack empty -> phase ends
  // After a non-pass action, priority stays with the actor (they may keep going).
  async priorityLoop() {
    let prioritized = this.activePlayer;
    let consecutivePasses = 0;

    while (!this.gameOver) {
      this.notify();
      const action = await prioritized.agent.choosePriorityAction(this);

      if (action.type === 'pass') {
        consecutivePasses++;
        if (consecutivePasses >= 2) {
          if (this.stack.isEmpty) return;
          await this.resolveTopOfStack();
          await this.checkStateBasedActions();
          consecutivePasses = 0;
          prioritized = this.activePlayer;
        } else {
          prioritized = this.opponentOf(prioritized);
        }
      } else {
        const happened = await this.executeAction(prioritized, action);
        if (happened) {
          await this.checkStateBasedActions();
          consecutivePasses = 0;
        }
        // Priority stays with the actor regardless.
      }
    }
  }

  async executeAction(player, action) {
    switch (action.type) {
      case 'play_land':       return this._actionPlayLand(player, action.card);
      case 'tap_for_mana':    return this._actionTapForMana(player, action.card);
      case 'cast':            return await this._actionCast(player, action.card);
    }
    return false;
  }

  _actionPlayLand(player, card) {
    if (player !== this.activePlayer) return false;
    if (!this.stack.isEmpty) return false;
    if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    if (player.landPlayedThisTurn) return false;
    if (!card.isLand || card.zone !== player.hand) return false;
    player.hand.remove(card);
    player.battlefield.add(card);
    player.landPlayedThisTurn = true;
    this.notify(`${player.name} plays ${card.name}.`);
    return true;
  }

  _actionTapForMana(player, card) {
    if (card.tapped || !card.isLand || card.zone !== player.battlefield) return false;
    if (card.controller !== player) return false;
    const manaAbility = card.def.abilities?.find(a => a.kind === 'mana');
    if (!manaAbility) return false;
    card.tapped = true;
    const produces = manaAbility.produces ?? {};
    for (const [color, amount] of Object.entries(produces)) {
      player.manaPool[color] = (player.manaPool[color] ?? 0) + amount;
    }
    this.notify(`${player.name} taps ${card.name} for mana (pool: ${formatPool(player.manaPool)}).`);
    return true;
  }

  async _actionCast(player, card) {
    if (card.zone !== player.hand) return false;
    if (!canPayCost(player.manaPool, card.cost)) return false;

    const isSorcerySpeed = card.isCreature || card.def.type === 'sorcery';
    if (isSorcerySpeed) {
      if (player !== this.activePlayer) return false;
      if (!this.stack.isEmpty) return false;
      if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    }

    // Gather X value before targets. Cancellation costs nothing.
    let xValue = 0;
    if (card.cost?.x === 'mana') {
      const maxX = maxXFromPool(player.manaPool, card.cost);
      xValue = await player.agent.chooseXValue(this, card, maxX);
      if (xValue == null || xValue < 0 || xValue > maxX) {
        this.notify(`${player.name} cancels casting ${card.name}.`);
        return false;
      }
    } else if (card.cost?.x === 'life') {
      const maxX = player.life;
      xValue = await player.agent.chooseXValue(this, card, maxX);
      if (xValue == null || xValue < 0 || xValue > maxX) {
        this.notify(`${player.name} cancels casting ${card.name}.`);
        return false;
      }
    }

    // Gather targets.
    const effects = card.def.effects ?? [];
    const targets = [];
    for (const effect of effects) {
      if (effect.target) {
        const t = await player.agent.chooseTarget(this, effect.target, card);
        if (t == null) {
          this.notify(`${player.name} cancels casting ${card.name}.`);
          return false;
        }
        if (!isValidTarget(t, effect.target, this, player)) {
          this.notify(`Invalid target.`);
          return false;
        }
        targets.push(t);
      } else {
        targets.push(null);
      }
    }

    // Pay mana (base, plus X if X is mana) and pay life (if X is life).
    const effectiveCost = { ...card.cost };
    if (card.cost?.x === 'mana' && xValue > 0) {
      effectiveCost.generic = (effectiveCost.generic ?? 0) + xValue;
    }
    payCost(player.manaPool, effectiveCost);
    if (card.cost?.x === 'life' && xValue > 0) {
      player.life -= xValue;
      this.notify(`${player.name} pays ${xValue} life.`);
    }
    player.hand.remove(card);

    if (card.isCreature) {
      player.battlefield.add(card);
      card.summoningSick = true;
      this.notify(`${player.name} casts ${card.name} (paid ${formatCost(effectiveCost)}).`);
    } else {
      this.stackZone.add(card);
      this.stack.push({
        type: 'spell',
        source: card,
        controller: player,
        targets,
        effects: card.def.effects ?? [],
        x: xValue,
      });
      const xText = card.cost?.x === 'mana' ? ` {X=${xValue}}` : '';
      this.notify(`${player.name} casts ${card.name}${xText}${this._describeTargets(targets)} (paid ${formatCost(effectiveCost)}).`);
    }
    return true;
  }

  _describeTargets(targets) {
    const named = targets.filter(t => t != null).map(t => t.name);
    if (named.length === 0) return '';
    return ` → ${named.join(', ')}`;
  }

  async resolveTopOfStack() {
    if (this.stack.isEmpty) return;
    const item = this.stack.pop();
    const { type, source, controller, targets, effects } = item;

    for (let i = 0; i < effects.length; i++) {
      const effectDef = effects[i];
      const target = targets[i];
      // Fizzle this effect if its chosen target became invalid.
      if (effectDef.target && !isValidTarget(target, effectDef.target, this, controller)) {
        this.notify(`${source.name}'s target is no longer valid.`);
        continue;
      }
      const fn = getEffect(effectDef.id);
      const ctx = { source, controller, target, x: item.x };
      await fn(this, ctx, effectDef);
    }

    if (type === 'spell') {
      this.stackZone.remove(source);
      if (source.def.type === 'instant' || source.def.type === 'sorcery') {
        controller.graveyard.add(source);
      }
    }
    // Triggered abilities: source stays where it is (battlefield, graveyard, etc.).
    this.notify(`${source.name} resolves.`);
  }

  // Single damage primitive — combat and effect-driven damage both route here so
  // deathtouch and lifelink hook in one place.
  dealDamage(source, target, amount) {
    if (amount <= 0 || !target) return;
    const tags = [];
    if (target.isPlayer) {
      target.life -= amount;
    } else {
      target.damage += amount;
      if (source.hasKeyword?.('deathtouch')) {
        target.markedForDeath = true;
        tags.push('deathtouch');
      }
    }
    if (source.hasKeyword?.('lifelink')) {
      source.controller.life += amount;
      tags.push('lifelink');
    }
    const tagText = tags.length ? ` (${tags.join(', ')})` : '';
    this.notify(`${source.name} deals ${amount} to ${target.name}${tagText}.`);
  }

  // SBA + trigger collection. Loops until quiescent so cascading deaths
  // (e.g., a dies-trigger that kills another creature) all settle here.
  // Triggers from this wave go on the stack but do NOT resolve here — they
  // resolve naturally when the priority loop next reaches the top of stack.
  async checkStateBasedActions() {
    while (true) {
      // Identify everything dying in this wave, BEFORE moving anything.
      const allDying = [];
      for (const p of this.players) {
        for (const c of p.battlefield.cards) {
          // A creature dies if damage >= toughness (covers 0/0 too) or
          // it's marked for death by deathtouch.
          if (c.isCreature && (c.damage >= c.toughness || c.markedForDeath)) {
            allDying.push(c);
          }
        }
      }
      if (allDying.length === 0) break;

      // Snapshot the pre-event battlefield. Triggers from simultaneous
      // deaths must see each other, so this scope is shared by every death
      // event in this wave.
      const scope = [];
      for (const p of this.players) scope.push(...p.battlefield.cards);

      // Move all dying creatures to graveyards simultaneously.
      for (const c of allDying) {
        this.movePermanentToGraveyard(c);
        this.notify(`${c.name} dies.`);
      }

      // Queue triggers for each death event using the shared pre-event scope.
      for (const c of allDying) {
        this._queueTriggersForEvent('creature_dies', { card: c, scope });
      }

      await this._processPendingTriggers();
    }
    for (const p of this.players) {
      if (p.life <= 0 && !this.gameOver) {
        this.gameOver = true;
        this.winner = this.opponentOf(p);
      }
    }
  }

  _queueTriggersForEvent(eventName, payload) {
    const scope = scopeForEvent(this, eventName, payload);
    for (const card of scope) {
      const triggers = card.def.triggers ?? [];
      for (const trigger of triggers) {
        if (trigger.event !== eventName) continue;
        if (!matchesCondition(trigger, card, payload)) continue;
        this._pendingTriggers.push({ source: card, trigger, payload });
      }
    }
  }

  // Drains _pendingTriggers, prompting each controller for targets, then
  // pushes each as a triggered_ability item onto the stack.
  async _processPendingTriggers() {
    while (this._pendingTriggers.length > 0) {
      const { source, trigger } = this._pendingTriggers.shift();
      const controller = source.controller;
      const effects = trigger.effects ?? [];
      const targets = [];
      let aborted = false;
      for (const effect of effects) {
        if (effect.target) {
          const t = await controller.agent.chooseTarget(this, effect.target, source);
          if (t == null) { aborted = true; break; }
          targets.push(t);
        } else {
          targets.push(null);
        }
      }
      if (aborted) {
        this.notify(`${source.name}'s trigger fizzles.`);
        continue;
      }
      this.stack.push({
        type: 'triggered_ability',
        source,
        controller,
        targets,
        effects,
      });
      this.notify(`${source.name}'s ability triggers.`);
    }
  }

  movePermanentToGraveyard(card) {
    if (card.zone) card.zone.remove(card);
    card.owner.graveyard.add(card);
    card.damage = 0;
    card.markedForDeath = false;
    card.tapped = false;
    card.grantedKeywords.clear();
    card.grantedPower = 0;
    card.grantedToughness = 0;
  }

  drawCard(player) {
    if (player.library.size === 0) {
      this.gameOver = true;
      this.winner = this.opponentOf(player);
      this.notify(`${player.name} can't draw — loses.`);
      return;
    }
    const card = player.library.drawTop();
    player.hand.add(card);
    this.notify(`${player.name} draws a card.`);
  }

  _drawSilent(player) {
    const card = player.library.drawTop();
    if (card) player.hand.add(card);
  }
}
