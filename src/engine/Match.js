import { Stack } from './Stack.js';
import { Zone } from '../cards/Zone.js';
import { isValidTarget } from './Targeting.js';
import { getEffect } from '../cards/effects/index.js';
import { matchesCondition, scopeForEvent } from './Triggers.js';
import { matchesReplacement, applyReplacement } from './Replacements.js';
import { runCombatPhase } from './Combat.js';
import { canPayCost, payCost, maxXFromPool, formatCost, formatPool, emptyPool } from './Cost.js';
import { Card } from '../cards/Card.js';
import database from '../cards/data/index.js';

export class Match {
  // options: { decklessLoss?: boolean }  — default true. When false, drawing
  // from an empty library is a no-op instead of an instant loss.
  constructor(players, options = {}) {
    this.players = players;
    this.activeIndex = 0;
    this.turn = 1;
    this.phase = 'pregame';
    this.gameOver = false;
    this.winner = null;
    this.log = [];
    this.onUpdate = null;
    this.decklessLoss = options.decklessLoss !== false;

    this.stack = new Stack();
    this.stackZone = new Zone('stack', null, { visibleTo: 'all', layout: 'stack' });
    this.combatStep = null;
    // Set during combat for agents that need to inspect the in-progress combat
    // (e.g., AI regen-in-response heuristic).
    this.currentAttackers = null;
    this.currentBlocks = null;
    // Triggers queued by an event but not yet placed on the stack (targets
    // need to be chosen first). Drained by _processPendingTriggers.
    this._pendingTriggers = [];
    // Delayed triggers registered to fire at a future controller+phase combo.
    // Entry: { controller, phase, source, computeEffects: () => effects[] }
    this.pendingDelayedTriggers = [];
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
    // Place any pre-configured starting battlefield cards (e.g., boss starts
    // with 3 Mountains in play). Cards are constructed fresh from the database
    // rather than drawn from library.
    for (const p of this.players) {
      this._placeStartingBattlefield(p);
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
    this.activePlayer.castFromGraveyardThisTurn = false;
    this.notify(`--- ${this.activePlayer.name}'s turn ${this.turn} ---`);

    this.phase = 'upkeep';
    await this._firePhaseBegins('upkeep');
    if (!this.stack.isEmpty) {
      await this.priorityLoop();
      if (this.gameOver) return;
    }

    this.phase = 'draw';
    if (!(this.turn === 1 && this.activeIndex === 0)) {
      this.drawCard(this.activePlayer);
    }

    this.phase = 'main1';
    await this._firePhaseBegins('main1');
    await this.priorityLoop();
    if (this.gameOver) return;

    this.phase = 'combat';
    await runCombatPhase(this);
    if (this.gameOver) return;

    this.phase = 'main2';
    await this._firePhaseBegins('main2');
    await this.priorityLoop();
    if (this.gameOver) return;

    this.phase = 'end';
    await this._firePhaseBegins('end');
    // Only spin a priority loop if a trigger queued something onto the stack.
    if (!this.stack.isEmpty) {
      await this.priorityLoop();
      if (this.gameOver) return;
    }
    for (const p of this.players) p.manaPool = emptyPool();
    for (const p of this.players) p.combatDamageTakenThisTurn = 0;
    // Clear "until end of turn" granted modifiers on every battlefield card.
    // Damage and tapped state are NOT cleared (damage persists per house rules;
    // tapped is cleared during the next untap step).
    for (const p of this.players) {
      for (const c of p.battlefield.cards) {
        c.grantedKeywords.clear();
        c.grantedPower = 0;
        c.grantedToughness = 0;
        c.regenerationShields = 0;
        c.cantRegenThisTurn = false;
      }
    }

    this.activeIndex = 1 - this.activeIndex;
    if (this.activeIndex === 0) this.turn++;
  }

  // Priority alternates between players when one passes.
  // Two consecutive passes:
  //   - stack non-empty -> resolve top, active gets priority back
  //   - stack empty -> phase ends
  // After a successful non-pass action, priority stays with the actor.
  // An action the engine refuses (executeAction returns false) is treated as
  // a pass so priority advances — this prevents infinite loops if an agent
  // ever emits an action the engine won't run.
  async priorityLoop() {
    let prioritized = this.activePlayer;
    let consecutivePasses = 0;

    while (!this.gameOver) {
      this.notify();
      const action = await prioritized.agent.choosePriorityAction(this);

      let passed = action.type === 'pass';
      if (!passed) {
        const happened = await this.executeAction(prioritized, action);
        if (happened) {
          await this.checkStateBasedActions();
          consecutivePasses = 0;
          continue;  // priority stays with the actor
        }
        passed = true;  // rejected — treat as pass
      }

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
    }
  }

  async executeAction(player, action) {
    switch (action.type) {
      case 'play_land':       return this._actionPlayLand(player, action.card);
      case 'tap_for_mana':    return this._actionTapForMana(player, action.card);
      case 'cast':            return await this._actionCast(player, action.card);
      case 'cast_from_graveyard': return await this._actionCastFromGraveyard(player, action.card);
      case 'activate':        return await this._actionActivate(player, action.card, action.abilityIndex ?? 0);
    }
    return false;
  }

  // Dry-run predicate: would `action` succeed if executed right now?
  // Mirrors the early-return checks in each _action* method. Agents call this
  // to avoid emitting actions the engine would reject (cheap to call). Note:
  // for 'cast'/'cast_from_graveyard' it only checks pre-target preconditions;
  // an action that passes here can still cancel during target collection.
  canExecute(player, action) {
    switch (action?.type) {
      case 'pass':               return true;
      case 'play_land':          return this._canPlayLand(player, action.card);
      case 'tap_for_mana':       return this._canTapForMana(player, action.card);
      case 'cast':               return this._canCast(player, action.card);
      case 'cast_from_graveyard':return this._canCastFromGraveyard(player, action.card);
      case 'activate': {
        const ab = action.card?.abilities?.[action.abilityIndex ?? 0];
        return this.canActivate(action.card, ab, player);
      }
    }
    return false;
  }

  _canPlayLand(player, card) {
    if (player !== this.activePlayer) return false;
    if (!this.stack.isEmpty) return false;
    if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    if (player.landPlayedThisTurn) return false;
    if (!card?.isLand || card.zone !== player.hand) return false;
    return true;
  }

  _actionPlayLand(player, card) {
    if (!this._canPlayLand(player, card)) return false;
    player.hand.remove(card);
    player.battlefield.add(card);
    player.landPlayedThisTurn = true;
    this.notify(`${player.name} plays ${card.name}.`);
    return true;
  }

  _canTapForMana(player, card) {
    if (!card || card.tapped || !card.isLand || card.zone !== player.battlefield) return false;
    if (card.controller !== player) return false;
    const manaAbility = card.def.abilities?.find(a => a.kind === 'mana');
    return !!manaAbility;
  }

  _actionTapForMana(player, card) {
    if (!this._canTapForMana(player, card)) return false;
    this._doTap(player, card);
    return true;
  }

  // Single tap effect: marks land tapped, adds its mana to the pool, notifies.
  // Shared by manual tap action and the engine's auto-tap inside cast/activate.
  _doTap(player, land) {
    const ability = land.def.abilities.find(a => a.kind === 'mana');
    land.tapped = true;
    for (const [color, amount] of Object.entries(ability.produces ?? {})) {
      player.manaPool[color] = (player.manaPool[color] ?? 0) + amount;
    }
    this.notify(`${player.name} taps ${land.name} for mana (pool: ${formatPool(player.manaPool)}).`);
  }

  // The mana pool a player COULD have if they tapped every untapped land they
  // control right now. Used for "can I afford this?" gates and maxX dialogs so
  // the agent doesn't have to pre-tap speculatively.
  _potentialPool(player) {
    const pool = { ...player.manaPool };
    for (const c of player.battlefield.cards) {
      if (!c.isLand || c.tapped) continue;
      const ability = c.def.abilities?.find(a => a.kind === 'mana');
      if (!ability) continue;
      for (const [color, amount] of Object.entries(ability.produces ?? {})) {
        pool[color] = (pool[color] ?? 0) + amount;
      }
    }
    return pool;
  }

  // Tap untapped lands until the pool covers `cost`. Color-prefer lands that
  // produce a deficit color first, then any. Returns true on success, false
  // if even with all untapped lands the cost can't be met (caller should
  // have validated via _potentialPool first).
  _autoTapForCost(player, cost) {
    let safety = 100;
    while (!canPayCost(player.manaPool, cost)) {
      if (safety-- <= 0) return false;
      const land = this._pickLandToAutoTap(player, cost);
      if (!land) return false;
      this._doTap(player, land);
    }
    return true;
  }

  _pickLandToAutoTap(player, cost) {
    const untapped = player.battlefield.cards.filter(c =>
      c.isLand && !c.tapped && c.def.abilities?.some(a => a.kind === 'mana')
    );
    if (untapped.length === 0) return null;
    // Try to satisfy a colored deficit first.
    for (const color of ['R', 'B']) {
      const need = (cost[color] ?? 0) - (player.manaPool[color] ?? 0);
      if (need <= 0) continue;
      const match = untapped.find(land => {
        const ability = land.def.abilities.find(a => a.kind === 'mana');
        return (ability?.produces?.[color] ?? 0) > 0;
      });
      if (match) return match;
    }
    // Otherwise any land helps (generic mana).
    return untapped[0];
  }

  _canCast(player, card) {
    if (!card || card.zone !== player.hand) return false;
    // Affordability is checked against the potential pool (current + everything
    // we could tap right now). The engine auto-taps inside _actionCast.
    if (!canPayCost(this._potentialPool(player), card.cost)) return false;
    const isSorcerySpeed = card.def.type !== 'instant';
    if (isSorcerySpeed) {
      if (player !== this.activePlayer) return false;
      if (!this.stack.isEmpty) return false;
      if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    }
    return true;
  }

  async _actionCast(player, card) {
    if (card.zone !== player.hand) return false;
    // Affordability is checked against the potential pool; the engine will
    // auto-tap below right before payment.
    if (!canPayCost(this._potentialPool(player), card.cost)) return false;

    // Anything that's not an instant is sorcery speed (creatures, sorceries,
    // artifacts, enchantments).
    const isSorcerySpeed = card.def.type !== 'instant';
    if (isSorcerySpeed) {
      if (player !== this.activePlayer) return false;
      if (!this.stack.isEmpty) return false;
      if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    }

    // Gather X value before targets. Cancellation costs nothing.
    let xValue = 0;
    if (card.cost?.x === 'mana') {
      const maxX = maxXFromPool(this._potentialPool(player), card.cost);
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

    // Expose chosen X to target-collection callers (e.g., AI lethal checks).
    if (card.cost?.x) card.xValue = xValue;

    // Gather targets. Each effect's target slot is an array of picks
    // (length 1 for normal, length N for X-target effects).
    const effects = card.def.effects ?? [];
    const targets = [];
    for (const effect of effects) {
      if (!effect.target) {
        targets.push([null]);
        continue;
      }
      const count = effect.target.count === 'x' ? (xValue ?? 0) : 1;
      const picks = [];
      for (let i = 0; i < count; i++) {
        const t = await player.agent.chooseTarget(this, effect.target, card, effect, picks);
        if (t == null) {
          if (picks.length === 0) {
            this.notify(`${player.name} cancels casting ${card.name}.`);
            return false;
          }
          break;  // proceed with partial picks
        }
        if (!isValidTarget(t, effect.target, this, player)) {
          this.notify(`Invalid target.`);
          return false;
        }
        if (picks.includes(t)) continue;  // skip duplicate
        picks.push(t);
      }
      targets.push(picks);
    }

    // Pay mana (base, plus X if X is mana) and pay life (if X is life).
    const effectiveCost = { ...card.cost };
    if (card.cost?.x === 'mana' && xValue > 0) {
      effectiveCost.generic = (effectiveCost.generic ?? 0) + xValue;
    }
    // Auto-tap any missing mana, then pay. Aborts if (shouldn't happen — we
    // already passed the potential-pool check above) tapping can't cover.
    if (!this._autoTapForCost(player, effectiveCost)) {
      this.notify(`${player.name} can't afford ${card.name}.`);
      return false;
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
      this._queueTriggersForEvent('creature_etb', { card });
      await this._processPendingTriggers();
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

  // Grandmother Isa: cast one creature from your graveyard per turn for the
  // mana cost + 2 life + discard one. The "Isa is in your graveyard" enabler
  // and the per-turn limit are checked here.
  _canCastFromGraveyard(player, card) {
    if (player !== this.activePlayer) return false;
    if (!this.stack.isEmpty) return false;
    if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    if (player.castFromGraveyardThisTurn) return false;
    if (!card || card.zone !== player.graveyard) return false;
    if (!card.isCreature) return false;
    if (player.life <= 2) return false;
    if (player.hand.cards.length === 0) return false;
    if (!player.graveyard.cards.some(c => c.def.id === 'grandmother_isa')) return false;
    if (!canPayCost(this._potentialPool(player), card.cost)) return false;
    return true;
  }

  async _actionCastFromGraveyard(player, card) {
    if (!this._canCastFromGraveyard(player, card)) return false;

    // Gather X up front (same flow as _actionCast).
    let xValue = 0;
    if (card.cost?.x === 'mana') {
      const maxX = maxXFromPool(this._potentialPool(player), card.cost);
      xValue = await player.agent.chooseXValue(this, card, maxX);
      if (xValue == null || xValue < 0 || xValue > maxX) {
        this.notify(`${player.name} cancels casting ${card.name}.`);
        return false;
      }
    } else if (card.cost?.x === 'life') {
      const maxX = player.life - 2;  // reserve the 2-life additional cost
      xValue = await player.agent.chooseXValue(this, card, Math.max(0, maxX));
      if (xValue == null || xValue < 0 || xValue > maxX) {
        this.notify(`${player.name} cancels casting ${card.name}.`);
        return false;
      }
    }
    if (card.cost?.x) card.xValue = xValue;

    // Targets.
    const effects = card.def.effects ?? [];
    const targets = [];
    for (const effect of effects) {
      if (!effect.target) { targets.push([null]); continue; }
      const count = effect.target.count === 'x' ? (xValue ?? 0) : 1;
      const picks = [];
      for (let i = 0; i < count; i++) {
        const t = await player.agent.chooseTarget(this, effect.target, card, effect, picks);
        if (t == null) {
          if (picks.length === 0) {
            this.notify(`${player.name} cancels casting ${card.name}.`);
            return false;
          }
          break;
        }
        if (!isValidTarget(t, effect.target, this, player)) {
          this.notify(`Invalid target.`);
          return false;
        }
        if (picks.includes(t)) continue;
        picks.push(t);
      }
      targets.push(picks);
    }

    // Discard pick (additional cost). Cancellation here voids the cast — no
    // mana/life paid yet.
    const discardPick = await player.agent.chooseDiscard(this);
    if (discardPick == null || discardPick.zone !== player.hand) {
      this.notify(`${player.name} cancels casting ${card.name}.`);
      return false;
    }

    // Pay all costs. Auto-tap any missing mana first.
    const effectiveCost = { ...card.cost };
    if (card.cost?.x === 'mana' && xValue > 0) {
      effectiveCost.generic = (effectiveCost.generic ?? 0) + xValue;
    }
    if (!this._autoTapForCost(player, effectiveCost)) {
      this.notify(`${player.name} can't afford ${card.name}.`);
      return false;
    }
    payCost(player.manaPool, effectiveCost);
    if (card.cost?.x === 'life' && xValue > 0) {
      player.life -= xValue;
      this.notify(`${player.name} pays ${xValue} life.`);
    }
    player.life -= 2;
    this.notify(`${player.name} pays 2 life (Isa).`);
    player.hand.remove(discardPick);
    player.graveyard.add(discardPick);
    this.notify(`${player.name} discards ${discardPick.name}.`);

    // Move the cast card from graveyard to battlefield.
    player.graveyard.remove(card);
    player.battlefield.add(card);
    card.summoningSick = true;
    player.castFromGraveyardThisTurn = true;
    this.notify(`${player.name} casts ${card.name} from graveyard (paid ${formatCost(effectiveCost)} + 2 life + discard).`);
    this._queueTriggersForEvent('creature_etb', { card });
    await this._processPendingTriggers();
    return true;
  }

  // Predicate: can `player` legally pay the activation cost and meet timing
  // restrictions for `ability` on `card` right now?
  canActivate(card, ability, player) {
    if (!ability || ability.kind !== 'activated') return false;
    if (card.zone?.name !== 'battlefield') return false;
    if (card.controller !== player) return false;
    if (ability.cost?.tap && card.tapped) return false;
    // Summoning sickness blocks tap costs on creatures (MtG rule 302.1).
    if (ability.cost?.tap && card.isCreature && card.summoningSick) return false;
    if (ability.cost?.mana && !canPayCost(this._potentialPool(player), ability.cost.mana)) return false;
    if (ability.cost?.life && player.life <= ability.cost.life) return false;
    if (ability.speed === 'sorcery') {
      if (player !== this.activePlayer) return false;
      if (!this.stack.isEmpty) return false;
      if (this.phase !== 'main1' && this.phase !== 'main2') return false;
    }
    return true;
  }

  async _actionActivate(player, card, abilityIndex) {
    const ability = card.abilities?.[abilityIndex];
    if (!this.canActivate(card, ability, player)) return false;

    // Gather targets (cancellation here is free — no cost has been paid).
    const effects = ability.effects ?? [];
    const targets = [];
    for (const effect of effects) {
      if (!effect.target) {
        targets.push([null]);
        continue;
      }
      const picks = [];
      const t = await player.agent.chooseTarget(this, effect.target, card, effect, picks);
      if (t == null) {
        this.notify(`${player.name} cancels activating ${card.name}.`);
        return false;
      }
      if (!isValidTarget(t, effect.target, this, player)) {
        this.notify(`Invalid target.`);
        return false;
      }
      picks.push(t);
      targets.push(picks);
    }

    // Pay activation cost: tap source, auto-tap lands for mana, deduct.
    if (ability.cost?.tap) card.tapped = true;
    if (ability.cost?.mana) {
      if (!this._autoTapForCost(player, ability.cost.mana)) {
        this.notify(`${player.name} can't afford to activate ${card.name}.`);
        return false;
      }
      payCost(player.manaPool, ability.cost.mana);
    }
    if (ability.cost?.life) {
      player.life -= ability.cost.life;
      this.notify(`${player.name} pays ${ability.cost.life} life.`);
    }

    this.stack.push({
      type: 'activated_ability',
      source: card,
      controller: player,
      targets,
      effects,
    });
    this.notify(`${player.name} activates ${card.name}'s ability${this._describeTargets(targets)}.`);
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
      const picks = targets[i] ?? [null];
      const fn = getEffect(effectDef.id);
      for (const target of picks) {
        // Fizzle this iteration if a previously-chosen target became invalid.
        if (effectDef.target && !isValidTarget(target, effectDef.target, this, controller)) {
          this.notify(`${source.name}'s target is no longer valid.`);
          continue;
        }
        const ctx = { source, controller, target, x: item.x };
        await fn(this, ctx, effectDef);
      }
    }

    if (type === 'spell') {
      this.stackZone.remove(source);
      if (source.def.type === 'instant' || source.def.type === 'sorcery') {
        controller.graveyard.add(source);
      } else if (source.def.type === 'artifact' || source.def.type === 'enchantment') {
        controller.battlefield.add(source);
      }
    }
    // Triggered abilities: source stays where it is (battlefield, graveyard, etc.).
    this.notify(`${source.name} resolves.`);
  }

  // Single damage primitive — combat and effect-driven damage both route here.
  // Replacement effects (e.g., Smokeweaver damage prevention) run first; then
  // deathtouch and lifelink hook in once damage is finalized.
  dealDamage(source, target, amount, opts = {}) {
    if (amount <= 0 || !target) return;

    // Apply damage replacement effects.
    const event = { type: 'damage_dealt', source, target, amount };
    this._applyReplacements(event);
    const prevented = event.prevented ?? 0;
    if (prevented > 0) {
      this.notify(`${prevented} damage to ${target.name} prevented.`);
    }
    amount = event.amount;
    if (amount <= 0) return;

    const tags = [];
    if (target.isPlayer) {
      target.life -= amount;
      if (opts.isCombat) target.combatDamageTakenThisTurn += amount;
    } else {
      target.damage += amount;
      // Track the source for "killed by X" triggers (Aunaratha etc.).
      target.dealtDamageBy.add(source);
      if (source.hasKeyword?.('deathtouch')) {
        target.markedForDeath = true;
        tags.push('deathtouch');
      }
    }
    if (source.hasKeyword?.('lifelink')) {
      if (!source.controller.cantGainLifeForever) {
        source.controller.life += amount;
        tags.push('lifelink');
      }
    }
    const tagText = tags.length ? ` (${tags.join(', ')})` : '';
    this.notify(`${source.name} deals ${amount} to ${target.name}${tagText}.`);
  }

  // Scans all battlefield cards for replacement effects matching the event,
  // and applies each (mutating event.amount in place).
  _applyReplacements(event) {
    for (const p of this.players) {
      for (const card of p.battlefield.cards) {
        const reps = card.def.replacements ?? [];
        for (const r of reps) {
          if (matchesReplacement(r, card, event)) {
            applyReplacement(r, event);
          }
        }
      }
    }
  }

  // SBA + trigger collection. Loops until quiescent so cascading deaths
  // (e.g., a dies-trigger that kills another creature) all settle here.
  // Triggers from this wave go on the stack but do NOT resolve here — they
  // resolve naturally when the priority loop next reaches the top of stack.
  async checkStateBasedActions() {
    while (true) {
      // Identify everything dying in this wave, BEFORE moving anything.
      // Creatures with regeneration shields consume one shield to be saved
      // instead of dying (damage cleared, tapped, stays on battlefield).
      const allDying = [];
      for (const p of this.players) {
        for (const c of p.battlefield.cards) {
          if (!c.isCreature) continue;
          const wouldDie = (c.damage >= c.toughness) || c.markedForDeath;
          if (!wouldDie) continue;
          if ((c.regenerationShields ?? 0) > 0 && !c.cantRegenThisTurn) {
            c.regenerationShields -= 1;
            c.damage = 0;
            c.markedForDeath = false;
            c.tapped = true;
            this.notify(`${c.name} regenerates.`);
          } else {
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

      // Snapshot each dying creature's killers (sources that damaged it)
      // before movePermanentToGraveyard wipes the state. Used by triggers
      // like Aunaratha's "destroyed by attached creature".
      const killersById = new Map();
      for (const c of allDying) {
        killersById.set(c, new Set(c.dealtDamageBy ?? []));
      }

      // Move all dying creatures to graveyards simultaneously.
      for (const c of allDying) {
        this.movePermanentToGraveyard(c);
        this.notify(`${c.name} dies.`);
      }

      // Queue triggers for each death event using the shared pre-event scope.
      for (const c of allDying) {
        this._queueTriggersForEvent('creature_dies', {
          card: c, scope, killers: killersById.get(c),
        });
      }

      await this._processPendingTriggers();
      this._vanishTokens();
    }
    for (const p of this.players) {
      if (p.life <= 0 && !this.gameOver) {
        this.gameOver = true;
        this.winner = this.opponentOf(p);
      }
    }
  }

  // Emits a phase_begins event and processes any triggers (e.g., Pox, Walk
  // on Coals) it queues. Caller decides whether to also run a priority loop.
  async _firePhaseBegins(phase) {
    this._queueTriggersForEvent('phase_begins', { phase, player: this.activePlayer });
    // Drain delayed triggers scheduled for this controller+phase. Their
    // computeEffects() runs now so amounts can reflect current state.
    const remaining = [];
    for (const dt of this.pendingDelayedTriggers) {
      if (dt.controller === this.activePlayer && dt.phase === phase) {
        this._pendingTriggers.push({
          source: dt.source,
          trigger: { effects: dt.computeEffects() },
          payload: {},
        });
      } else {
        remaining.push(dt);
      }
    }
    this.pendingDelayedTriggers = remaining;
    await this._processPendingTriggers();
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
      // Optional triggers ("you may ..."): skip silently if the cost isn't
      // payable, otherwise ask the controller. On yes, pay the cost up front.
      if (trigger.optional) {
        const lifeCost = trigger.cost?.life ?? 0;
        if (lifeCost > 0 && controller.life < lifeCost) continue;
        const ok = await controller.agent.confirmTrigger(this, source, trigger);
        if (!ok) continue;
        if (lifeCost > 0) {
          controller.life -= lifeCost;
          this.notify(`${controller.name} pays ${lifeCost} life for ${source.name}.`);
        }
      }
      const effects = trigger.effects ?? [];
      const targets = [];
      let aborted = false;
      for (const effect of effects) {
        if (!effect.target) {
          targets.push([null]);
          continue;
        }
        const picks = [];
        // Triggers don't currently use X-target; treat as single-pick.
        const t = await controller.agent.chooseTarget(this, effect.target, source, effect, picks);
        if (t == null) { aborted = true; break; }
        picks.push(t);
        targets.push(picks);
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
        x: source.xValue ?? 0,
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
    card.counters = {};  // counters reset when leaving the battlefield (MtG rule)
    card.regenerationShields = 0;
    card.cantRegenThisTurn = false;
    card.dealtDamageBy = new Set();
    card.xValue = 0;
    // Equipment cleanup: clear our own attachment, and detach any equipment
    // that was attached to us.
    card.attachedTo = null;
    if (card.controller?.battlefield) {
      for (const c of card.controller.battlefield.cards) {
        if (c.attachedTo === card) c.attachedTo = null;
      }
    }
  }

  // Tokens cease to exist when they leave the battlefield. They go to graveyard
  // briefly (so dies-triggers can fire via LKI), then this cleanup removes them.
  _vanishTokens() {
    for (const p of this.players) {
      for (const zoneName of ['graveyard', 'hand', 'exile', 'library']) {
        const zone = p[zoneName];
        if (!zone) continue;
        const tokens = zone.cards.filter(c => c.def?.isToken);
        for (const t of tokens) zone.remove(t);
      }
    }
  }

  drawCard(player) {
    if (player.library.size === 0) {
      if (this.decklessLoss) {
        this.gameOver = true;
        this.winner = this.opponentOf(player);
        this.notify(`${player.name} can't draw — loses.`);
      } else {
        this.notify(`${player.name} can't draw (empty library — rule disabled).`);
      }
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

  // Instantiates the cards named in player.startingBattlefield and adds them
  // to the battlefield zone. Lands enter untapped. Creatures enter without
  // summoning sickness (interpreted as having already been there).
  _placeStartingBattlefield(player) {
    const ids = player.startingBattlefield ?? [];
    for (const cardId of ids) {
      const def = database[cardId];
      if (!def) {
        this.notify(`(skipping unknown starting card: ${cardId})`);
        continue;
      }
      const card = new Card(def, player);
      player.battlefield.add(card);
    }
  }
}
