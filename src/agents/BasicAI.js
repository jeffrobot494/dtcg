import { Agent } from './Agent.js';
import { canPayCost } from '../engine/Cost.js';
import { isValidTarget } from '../engine/Targeting.js';
import { canBlock } from '../engine/Combat.js';

// Heuristic AI. Plugs into the same Agent seam HumanAgent uses; the engine
// can't tell the difference. Plays legally and makes sensible (not optimal)
// decisions. Tuning targets: don't lose to itself, close out wins, don't
// suicide-attack.
//
// Per current policy: passes on opponent's turn and any time the stack is
// non-empty. Acts only during its own main phases.

const DELAY_MS = 400;

export class BasicAI extends Agent {
  constructor() {
    super();
    this.pending = null;  // UI looks for this on HumanAgent; AI never sets it.
  }

  async choosePriorityAction(match) {
    const me = this._meIn(match);
    if (me !== match.activePlayer || !match.stack.isEmpty) {
      return { type: 'pass' };
    }
    const action = this._mainPhaseAction(match, me);
    if (action.type !== 'pass') await delay(DELAY_MS);
    return action;
  }

  async chooseTarget(match, filter, source, effect, picks) {
    // No delay — sub-decision inside an already-paced cast.
    return this._pickTarget(match, filter, source, effect, picks);
  }

  async chooseXValue(match, card, max) {
    // Mana X: dump everything (more damage / effect = better).
    if (card.cost?.x === 'mana') return max;
    // Life X: target 5 (Simulacrum's Flying threshold) but always leave a
    // 2-life buffer so we don't suicide on the cost.
    if (card.cost?.x === 'life') {
      const me = this._meIn(match);
      return Math.max(0, Math.min(max, 5, me.life - 2));
    }
    return max;
  }

  async declareAttackers(match) {
    await delay(DELAY_MS);
    return this._pickAttackers(match);
  }

  async declareBlockers(match, attackers) {
    await delay(DELAY_MS);
    return this._pickBlockers(match, attackers);
  }

  // Default to yes unless paying would kill us. Engine has already verified
  // the cost is payable before asking.
  async confirmTrigger(match, source, trigger) {
    const me = this._meIn(match);
    const lifeCost = trigger.cost?.life ?? 0;
    if (lifeCost > 0 && me.life - lifeCost <= 0) return false;
    return true;
  }

  // ---------- decision policies ----------

  _meIn(match) {
    return match.players.find(p => p.agent === this);
  }

  _mainPhaseAction(match, me) {
    // 1. Play a land if we haven't this turn.
    if (!me.landPlayedThisTurn) {
      const land = me.hand.cards.find(c => c.isLand);
      if (land) return { type: 'play_land', card: land };
    }

    // 1.5. Activate any useful, affordable ability on our battlefield.
    for (const c of me.battlefield.cards) {
      const abilities = c.abilities ?? [];
      for (let i = 0; i < abilities.length; i++) {
        const ab = abilities[i];
        if (ab.kind !== 'activated') continue;
        if (!match.canActivate(c, ab, me)) continue;
        if (!abilityHasUsefulTargets(match, ab, me, c)) continue;
        if (!activationIsWorthwhile(c, ab)) continue;
        return { type: 'activate', card: c, abilityIndex: i };
      }
    }

    // 2. Build "playable" list = spells we could cast + activations we could
    //    fire if all our lands were tapped. Sort by mana value (highest first)
    //    and pick a target. This unification ensures AI taps toward activated
    //    abilities (e.g., equip) even when the hand has nothing to cast.
    const potential = potentialPool(me);

    const haveCreatureOnBattlefield = me.battlefield.cards.some(c => c.isCreature);
    const spellOptions = me.hand.cards
      .filter(c => !c.isLand)
      .filter(c => canPayCost(potential, c.cost))
      .filter(c => allTargetsAvailable(match, c, me))
      .filter(c => affordsMeaningfulX(c, potential))
      // Don't cast equipment with no creature to wear it — its only value is
      // the equip ability, and that needs a target.
      .filter(c => c.def.subtype !== 'equipment' || haveCreatureOnBattlefield)
      // Terror grants Fear to your creatures — useless with none on board.
      .filter(c => c.def.id !== 'terror' || haveCreatureOnBattlefield)
      // Read the Scars only pays off if we've already landed combat damage
      // this turn — so wait for main2 and require at least 1 such damage.
      .filter(c => c.def.id !== 'read_the_scars' ||
        (match.phase === 'main2' &&
         match.opponentOf(me).combatDamageTakenThisTurn >= 1))
      .map(c => ({ kind: 'cast', card: c, cost: c.cost, mv: totalManaCost(c.cost) }));

    const activationOptions = [];
    for (const c of me.battlefield.cards) {
      const abilities = c.abilities ?? [];
      for (let i = 0; i < abilities.length; i++) {
        const ab = abilities[i];
        if (ab.kind !== 'activated') continue;
        // Tap-only (no mana) abilities are handled by step 1.5; if step 1.5
        // didn't fire it, conditions (sickness, tapped, etc.) aren't met.
        if (!ab.cost?.mana) continue;
        if (!canPayCost(potential, ab.cost.mana)) continue;
        if (ab.speed === 'sorcery') {
          if (me !== match.activePlayer) continue;
          if (!match.stack.isEmpty) continue;
          if (match.phase !== 'main1' && match.phase !== 'main2') continue;
        }
        if (!abilityHasUsefulTargets(match, ab, me, c)) continue;
        if (!activationIsWorthwhile(c, ab)) continue;
        activationOptions.push({
          kind: 'activate', card: c, abilityIndex: i,
          cost: ab.cost.mana, mv: totalManaCost(ab.cost.mana),
        });
      }
    }

    const playable = [...spellOptions, ...activationOptions]
      .sort((a, b) => b.mv - a.mv);

    if (playable.length === 0) return { type: 'pass' };
    const target = playable[0];

    // 3. If we have enough mana RIGHT NOW, do it — but for X-mana spells, tap
    //    any remaining lands first so X is as large as possible.
    if (canPayCost(me.manaPool, target.cost)) {
      if (target.kind === 'cast') {
        const isXMana = target.cost?.x === 'mana';
        const hasUntapped = me.battlefield.cards.some(c => c.isLand && !c.tapped);
        if (!(isXMana && hasUntapped)) {
          return { type: 'cast', card: target.card };
        }
      } else {
        return { type: 'activate', card: target.card, abilityIndex: target.abilityIndex };
      }
    }

    // 4. Otherwise tap a land toward the target's cost.
    const fakeCard = target.kind === 'cast' ? target.card : { cost: target.cost };
    const land = pickLandToTap(me, fakeCard);
    if (land) return { type: 'tap_for_mana', card: land };

    return { type: 'pass' };
  }

  _pickTarget(match, filter, source, effect, picks = []) {
    const me = this._meIn(match);
    const opp = match.opponentOf(me);

    // Candidates can live on the battlefield (creatures, lands, etc.) or in
    // any graveyard (for filters like creature_in_graveyard). Exclude anything
    // we've already picked in this same X-target collection.
    const candidates = [];
    for (const p of match.players) {
      if (isValidTarget(p, filter, match, me) && !picks.includes(p)) {
        candidates.push(p);
      }
      for (const c of p.battlefield.cards) {
        if (isValidTarget(c, filter, match, me) && !picks.includes(c)) {
          candidates.push(c);
        }
      }
      for (const c of p.graveyard.cards) {
        if (isValidTarget(c, filter, match, me) && !picks.includes(c)) {
          candidates.push(c);
        }
      }
    }
    if (candidates.length === 0) return null;

    // For heal-style effects, prefer the most damaged creature.
    if (effect?.id === 'remove_damage') {
      const damaged = candidates.filter(t => !t.isPlayer && t.damage > 0);
      if (damaged.length > 0) {
        damaged.sort((a, b) => b.damage - a.damage);
        return damaged[0];
      }
    }
    // For toughness-reducing modifiers, pick a killable enemy creature.
    if (effect?.id === 'modify_stats' && (effect.toughness ?? 0) < 0) {
      const dT = effect.toughness;
      const killable = candidates.filter(t =>
        !t.isPlayer && t.controller === opp && t.damage >= (t.toughness + dT)
      );
      if (killable.length > 0) {
        killable.sort((a, b) => valueOfCreature(b) - valueOfCreature(a));
        return killable[0];
      }
    }
    // For destroy_target: only target opponent permanents. If none exist,
    // fizzle (returning null aborts the cast cleanly before mana is paid).
    if (effect?.id === 'destroy_target') {
      const hostile = candidates.filter(t => !t.isPlayer && t.controller === opp);
      if (hostile.length > 0) return hostile[0];
      return null;
    }
    // For exile-from-graveyard (Press Into Service): prefer opponent's
    // creature cards (denial), fall back to biggest available card.
    if (effect?.id === 'exile_target') {
      const cards = candidates.filter(t => !t.isPlayer && t.isCreature);
      const oppCards = cards.filter(t => t.owner === opp);
      const pool = oppCards.length > 0 ? oppCards : cards;
      if (pool.length === 0) return null;
      pool.sort((a, b) => valueOfCreature(b) - valueOfCreature(a));
      return pool[0];
    }
    // For exile-and-golem (Honor with Immortality): pick the biggest creature
    // card anywhere; we'll get a copy of its P/T.
    if (effect?.id === 'exile_and_golem') {
      const cards = candidates.filter(t => !t.isPlayer && t.isCreature);
      if (cards.length === 0) return null;
      cards.sort((a, b) => valueOfCreature(b) - valueOfCreature(a));
      return cards[0];
    }
    // For return-to-hand / return-to-battlefield: pick the biggest creature
    // card from our own graveyard (filter already restricts).
    if (effect?.id === 'return_to_hand' || effect?.id === 'return_to_battlefield') {
      const own = candidates.filter(t => !t.isPlayer && t.isCreature && t.owner === me);
      if (own.length === 0) return null;
      own.sort((a, b) => valueOfCreature(b) - valueOfCreature(a));
      return own[0];
    }
    // For attach: equip to the biggest friendly creature. The "useful targets"
    // check (isUsefulTarget) has already filtered out the current attachment
    // and any creature that isn't a strict improvement — so any candidate
    // making it here is a valid target.
    if (effect?.id === 'attach') {
      const friendly = candidates.filter(t =>
        !t.isPlayer && t.isCreature && t.controller === me &&
        t !== source?.attachedTo
      );
      if (friendly.length === 0) return null;
      friendly.sort((a, b) => valueOfCreature(b) - valueOfCreature(a));
      return friendly[0];
    }
    // For grant_keywords: prefer friendly creatures that don't already have all
    // the granted keywords. Among those, prefer current attackers (tapped,
    // non-sick) since the grant lasts only until end of turn.
    if (effect?.id === 'grant_keywords') {
      const keywords = effect.keywords ?? [];
      const friendly = candidates.filter(t =>
        !t.isPlayer && t.isCreature && t.controller === me
      );
      const needsIt = friendly.filter(t => keywords.some(k => !t.hasKeyword(k)));
      if (needsIt.length > 0) {
        const attacking = needsIt.filter(t => t.tapped && !t.summoningSick);
        const pool = attacking.length > 0 ? attacking : needsIt;
        pool.sort((a, b) => valueOfCreature(b) - valueOfCreature(a));
        return pool[0];
      }
    }

    const enemies = candidates.filter(t => t === opp || t.controller === opp);
    if (enemies.length > 0) {
      // Lethal check: if this damage spell would kill opponent, take the win.
      if (effect?.id === 'deal_damage' && enemies.includes(opp)) {
        const dmg = effect.amount === 'x'      ? (source?.xValue ?? 0)
                  : effect.amount === 'half_x' ? Math.ceil((source?.xValue ?? 0) / 2)
                  : (effect.amount ?? 0);
        if (dmg >= opp.life) return opp;
      }
      // Finisher: dump damage on opponent if they're nearly dead anyway.
      if (opp.life <= 5 && enemies.includes(opp)) return opp;
      const enemyCreatures = enemies.filter(t => t.isCreature);
      if (enemyCreatures.length > 0) {
        return enemyCreatures.reduce((best, c) =>
          valueOfCreature(c) > valueOfCreature(best) ? c : best
        );
      }
      if (enemies.includes(opp)) return opp;
      // Non-creature enemy permanents (lands, artifacts, enchantments) — e.g.,
      // Conflagration / Destroy Artifact. Hit one of theirs, not ours.
      const otherEnemies = enemies.filter(t => !t.isPlayer);
      if (otherEnemies.length > 0) return otherEnemies[0];
    }

    // Fall through: must be a friendly target (buff/heal-style filter).
    const friends = candidates.filter(t => t === me || t.controller === me);
    if (friends.length > 0) {
      const myCreatures = friends.filter(t => t.isCreature);
      if (myCreatures.length > 0) {
        return myCreatures.reduce((best, c) =>
          valueOfCreature(c) > valueOfCreature(best) ? c : best
        );
      }
      return friends[0];
    }
    return candidates[0];
  }

  _pickAttackers(match) {
    const me = this._meIn(match);
    const opp = match.opponentOf(me);
    const eligible = me.battlefield.cards
      .filter(c => c.isCreature && !c.tapped && !c.summoningSick)
      // Skip 0-power: no damage, and deathtouch needs nonzero damage to fire.
      .filter(c => c.power > 0);

    if (eligible.length === 0) return [];

    const oppBlockers = opp.battlefield.cards.filter(c =>
      c.isCreature && !c.tapped
    );

    if (oppBlockers.length === 0) return eligible;  // free chip damage

    // For up to SUBSET_THRESHOLD attackers, search every subset and pick the
    // one with the best simulated net value. Above that, fall back to a
    // greedy backwards-prune to stay fast.
    if (eligible.length <= SUBSET_THRESHOLD) {
      return pickAttackersExhaustive(eligible, oppBlockers, opp, me);
    }
    return pickAttackersGreedy(eligible, oppBlockers, opp, me);
  }

  _pickBlockers(match, attackers) {
    const me = this._meIn(match);
    const available = me.battlefield.cards.filter(c =>
      c.isCreature && !c.tapped
    );
    const blocks = [];
    const used = new Set();
    const totalIncoming = attackers.reduce((s, a) => s + a.power, 0);
    const lethal = totalIncoming >= me.life;

    // Block biggest threats first so the best blockers get prioritized.
    const sorted = [...attackers].sort((a, b) =>
      valueOfCreature(b) - valueOfCreature(a)
    );

    for (const attacker of sorted) {
      const eligible = available.filter(b =>
        !used.has(b) && canBlock(b, attacker)
      );
      if (eligible.length === 0) continue;

      // Best case: blocker survives AND kills the attacker.
      const goodTrade = eligible.find(b =>
        (b.toughness - b.damage) > attacker.power &&
        b.power >= (attacker.toughness - attacker.damage)
      );
      if (goodTrade) {
        blocks.push({ attacker, blocker: goodTrade });
        used.add(goodTrade);
        continue;
      }

      // Acceptable trade: blocker dies but kills the attacker (and attacker is
      // at least as valuable).
      const fairTrade = eligible.find(b =>
        b.power >= (attacker.toughness - attacker.damage) &&
        valueOfCreature(b) <= valueOfCreature(attacker)
      );
      if (fairTrade) {
        blocks.push({ attacker, blocker: fairTrade });
        used.add(fairTrade);
        continue;
      }

      // Chump-block to survive when at low life or facing lethal.
      if (lethal || me.life <= 5) {
        eligible.sort((a, b) => valueOfCreature(a) - valueOfCreature(b));
        const chump = eligible[0];
        blocks.push({ attacker, blocker: chump });
        used.add(chump);
      }
    }
    return blocks;
  }
}

// ---------- helpers ----------

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Picks an untapped land to tap that best helps the target's cost. Prefers a
// land matching a colored shortfall; falls back to any untapped land.
function pickLandToTap(player, targetCard) {
  const untapped = player.battlefield.cards.filter(c => c.isLand && !c.tapped);
  if (untapped.length === 0) return null;
  const cost = targetCard?.cost;
  if (!cost) return untapped[0];

  // Find colors where we still need more than we have.
  for (const color of ['R', 'B']) {
    const need = cost[color] ?? 0;
    const have = player.manaPool[color] ?? 0;
    if (need <= have) continue;
    const matching = untapped.find(land => {
      const ability = land.def.abilities?.find(a => a.kind === 'mana');
      return (ability?.produces?.[color] ?? 0) > 0;
    });
    if (matching) return matching;
  }
  // No colored deficit — generic mana, any land is fine.
  return untapped[0];
}

function potentialPool(player) {
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

function totalManaCost(cost) {
  if (!cost) return 0;
  let total = cost.generic ?? 0;
  for (const c of ['R', 'B']) total += cost[c] ?? 0;
  return total;
}

// For X-mana cards, returns true if the potential pool covers base + X=1.
// X=0 casts of our scaling-effect cards do nothing, so skip them.
function affordsMeaningfulX(card, potential) {
  if (card.cost?.x !== 'mana') return true;
  const withOneX = { ...card.cost, generic: (card.cost.generic ?? 0) + 1 };
  return canPayCost(potential, withOneX);
}

// Up to this many eligible attackers, the AI tries every subset (2^N) and
// picks the best by simulated net value. Beyond it, greedy backwards-prune.
const SUBSET_THRESHOLD = 10;

// Returns the subset of `eligible` that maximizes simulated combat value.
function pickAttackersExhaustive(eligible, blockers, opp, me) {
  let best = [];
  let bestValue = 0;  // not attacking = baseline 0
  for (let mask = 0; mask < (1 << eligible.length); mask++) {
    const subset = [];
    for (let i = 0; i < eligible.length; i++) {
      if (mask & (1 << i)) subset.push(eligible[i]);
    }
    const value = simulateCombat(subset, blockers, opp, me);
    if (value > bestValue) {
      bestValue = value;
      best = subset;
    }
  }
  return best;
}

// Start with all eligible; remove the worst-contributing attacker one at a
// time until no removal improves the score. Last resort for large boards.
function pickAttackersGreedy(eligible, blockers, opp, me) {
  let attackers = [...eligible];
  let baseValue = simulateCombat(attackers, blockers, opp, me);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < attackers.length; i++) {
      const without = attackers.filter((_, j) => j !== i);
      const value = simulateCombat(without, blockers, opp, me);
      if (value > baseValue) {
        attackers = without;
        baseValue = value;
        changed = true;
        break;
      }
    }
  }
  return baseValue > 0 ? attackers : [];
}

// Simulates a single combat: attackers vs blockers under the assumption that
// the defender plays greedy-optimal (assigns cheapest killer to each attacker
// in threat order, takes face damage when no killer exists unless lethal).
// Returns net value to the AI: opp creature value lost + face damage - own
// creature value lost. Lethal damage is weighted overwhelmingly.
function simulateCombat(attackers, blockers, opp, me) {
  // Defender prioritizes biggest threats first when assigning blocks.
  const queue = [...attackers].sort((a, b) =>
    valueOfCreature(b) - valueOfCreature(a)
  );
  const available = [...blockers];
  const deadBlockers = new Set();

  let aiLosses = 0;
  let oppLosses = 0;
  let damageToOpp = 0;

  for (const a of queue) {
    const legal = available.filter(b => simCanBlock(a, b));
    if (legal.length === 0) {
      damageToOpp += a.power;
      continue;
    }
    const killers = legal.filter(b => simWouldKill(b, a));
    if (killers.length > 0) {
      const blocker = killers.reduce((m, b) =>
        valueOfCreature(b) < valueOfCreature(m) ? b : m
      );
      aiLosses += valueOfCreature(a);
      if (simWouldKill(a, blocker)) {
        oppLosses += valueOfCreature(blocker);
        deadBlockers.add(blocker);
      }
      available.splice(available.indexOf(blocker), 1);
      continue;
    }
    // No killer — defender chumps only if next hit would be lethal.
    const lifeIfTaken = opp.life - damageToOpp - a.power;
    if (lifeIfTaken <= 0) {
      const chump = legal.reduce((m, b) =>
        valueOfCreature(b) < valueOfCreature(m) ? b : m
      );
      if (simWouldKill(a, chump)) {
        oppLosses += valueOfCreature(chump);
        deadBlockers.add(chump);
      }
      available.splice(available.indexOf(chump), 1);
    } else {
      damageToOpp += a.power;
    }
  }

  // Lethal damage wins on the spot — opp doesn't get a counter-attack.
  if (damageToOpp >= opp.life) return 1000;

  // Counter-attack risk: if attacking taps our creatures and leaves us open
  // to lethal damage on opponent's turn, refuse the attack entirely.
  if (me) {
    const attackerSet = new Set(attackers);
    const oppCounterPower = opp.battlefield.cards
      .filter(c => c.isCreature && !deadBlockers.has(c))
      .reduce((s, c) => s + c.power, 0);
    const aiBlockToughness = me.battlefield.cards
      .filter(c => c.isCreature && !attackerSet.has(c))
      .reduce((s, c) => s + c.toughness, 0);
    const expectedDamage = Math.max(0, oppCounterPower - aiBlockToughness);
    if (me.life - expectedDamage <= 0) return -1000;
  }

  // Face damage weighted 1.5× creature value: damage is the win condition,
  // creatures are just a means. Nudges the AI toward aggression when an
  // attack would otherwise tie 1:1 in pure value.
  return oppLosses + damageToOpp * 1.5 - aiLosses;
}

function simCanBlock(attacker, blocker) {
  if (attacker.hasKeyword('flying') && !blocker.hasKeyword('flying')) return false;
  return true;
}

function simWouldKill(source, target) {
  if (source.hasKeyword('deathtouch') && source.power > 0) return true;
  return source.power >= (target.toughness - target.damage);
}

function valueOfCreature(card) {
  if (!card.isCreature) return 0;
  let v = card.power + card.toughness;
  if (card.hasKeyword('flying'))     v += 2;
  if (card.hasKeyword('trample'))    v += 1;
  if (card.hasKeyword('deathtouch')) v += 3;
  if (card.hasKeyword('lifelink'))   v += 1;
  return v;
}

function allTargetsAvailable(match, card, controller) {
  for (const effect of card.def.effects ?? []) {
    if (!effect.target) continue;
    if (!hasUsefulTarget(match, effect, controller, card)) return false;
  }
  return true;
}

// Same idea as allTargetsAvailable but for activated-ability effects.
// Per-ability sanity check (in addition to "has useful targets"). Currently
// suppresses regen activation: the AI doesn't act on opponent's turn yet, and
// shields expire at EOT, so pre-emptive shielding on its own turn wastes mana.
// Revisit when the AI gets instant-speed responses.
function activationIsWorthwhile(source, ability) {
  for (const eff of ability.effects ?? []) {
    if (eff.id === 'add_regen_shield') return false;
  }
  return true;
}

function abilityHasUsefulTargets(match, ability, controller, source) {
  for (const effect of ability.effects ?? []) {
    if (!effect.target) continue;
    if (!hasUsefulTarget(match, effect, controller, source)) return false;
  }
  return true;
}

// Like "has any valid target" but also screens out targets the effect couldn't
// do anything useful to (e.g., healing an undamaged creature, re-attaching
// equipment to the same creature it's already on).
function hasUsefulTarget(match, effect, controller, source) {
  for (const p of match.players) {
    if (isValidTarget(p, effect.target, match, controller) && isUsefulTarget(effect, p, controller, source)) return true;
    for (const c of p.battlefield.cards) {
      if (isValidTarget(c, effect.target, match, controller) && isUsefulTarget(effect, c, controller, source)) return true;
    }
    // Graveyard cards can also be targets (Press Into Service, Honor with
    // Immortality, Come Home, Immortality).
    for (const c of p.graveyard.cards) {
      if (isValidTarget(c, effect.target, match, controller) && isUsefulTarget(effect, c, controller, source)) return true;
    }
  }
  return false;
}

// Effect-specific "would this target actually benefit from / suffer from this effect?"
function isUsefulTarget(effect, target, controller, source) {
  if (effect.id === 'remove_damage') {
    return !target.isPlayer && target.damage > 0;
  }
  if (effect.id === 'modify_stats') {
    if (target.isPlayer) return false;
    const dT = effect.toughness ?? 0;
    // Negative toughness change: only worth casting as removal (would kill).
    if (dT < 0) return target.damage >= (target.toughness + dT);
    // Positive/zero toughness change: a buff, useful on own creatures.
    return target.controller === controller;
  }
  if (effect.id === 'grant_keywords') {
    // Granted keywords last only until end of turn, so a summoning-sick
    // creature can't benefit (it can't attack this turn). Since the AI
    // doesn't cast on the opponent's turn, blocking isn't a use case either.
    if (target.isPlayer) return false;
    if (target.summoningSick) return false;
    return true;
  }
  if (effect.id === 'destroy_target') {
    // Only worth casting against opponent permanents.
    return !target.isPlayer && target.controller !== controller;
  }
  if (effect.id === 'attach') {
    // Re-equipping isn't useful unless we're switching to a strictly more
    // valuable creature. This must stay in sync with _pickTarget for 'attach'.
    if (target.isPlayer) return false;
    if (!target.isCreature) return false;
    if (target.controller !== controller) return false;
    if (source?.attachedTo) {
      if (target === source.attachedTo) return false;
      if (valueOfCreature(target) <= valueOfCreature(source.attachedTo)) return false;
    }
    return true;
  }
  return true;
}
