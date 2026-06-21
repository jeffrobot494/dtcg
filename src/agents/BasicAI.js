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

  async chooseTarget(match, filter, source, effect) {
    // No delay — sub-decision inside an already-paced cast.
    return this._pickTarget(match, filter, source, effect);
  }

  async chooseXValue(match, card, max) {
    // Mana X: dump everything (more damage / effect = better).
    if (card.cost?.x === 'mana') return max;
    // Life X: spend conservatively so we don't suicide-heal.
    if (card.cost?.x === 'life') return Math.min(max, 4);
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

    // 2. Find the highest-cost card we could afford if all our lands were tapped.
    //    Skip targeted spells with no legal targets so we don't fizzle.
    const potential = potentialPool(me);
    const playable = me.hand.cards
      .filter(c => !c.isLand)
      .filter(c => canPayCost(potential, c.cost))
      .filter(c => allTargetsAvailable(match, c, me))
      .sort((a, b) => totalManaCost(b.cost) - totalManaCost(a.cost));

    if (playable.length === 0) return { type: 'pass' };
    const target = playable[0];

    // 3. If we already have enough mana, cast it.
    if (canPayCost(me.manaPool, target.cost)) {
      return { type: 'cast', card: target };
    }

    // 4. Otherwise tap a land that helps pay for the target. Picks a land
    //    matching a colored deficit when possible; falls back to any untapped
    //    land for generic mana.
    const land = pickLandToTap(me, target);
    if (land) return { type: 'tap_for_mana', card: land };

    return { type: 'pass' };
  }

  _pickTarget(match, filter, source, effect) {
    const me = this._meIn(match);
    const opp = match.opponentOf(me);

    const candidates = [];
    for (const p of match.players) {
      if (isValidTarget(p, filter, match, me)) candidates.push(p);
      for (const c of p.battlefield.cards) {
        if (isValidTarget(c, filter, match, me)) candidates.push(c);
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
      // Lethal-eyeing finisher: dump damage on opponent if they're nearly dead.
      if (opp.life <= 5 && enemies.includes(opp)) return opp;
      const enemyCreatures = enemies.filter(t => t.isCreature);
      if (enemyCreatures.length > 0) {
        return enemyCreatures.reduce((best, c) =>
          valueOfCreature(c) > valueOfCreature(best) ? c : best
        );
      }
      if (enemies.includes(opp)) return opp;
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
    const eligible = me.battlefield.cards.filter(c =>
      c.isCreature && !c.tapped && !c.summoningSick
    );
    const oppBlockers = opp.battlefield.cards.filter(c =>
      c.isCreature && !c.tapped
    );

    if (oppBlockers.length === 0) return eligible;  // free damage

    const biggest = oppBlockers.reduce((m, b) =>
      valueOfCreature(b) > valueOfCreature(m) ? b : m
    );

    return eligible.filter(a => {
      // Flying past no flying blockers = always attack.
      if (a.hasKeyword('flying') && !oppBlockers.some(b => b.hasKeyword('flying'))) {
        return true;
      }
      // Deathtouch always trades up.
      if (a.hasKeyword('deathtouch')) return true;
      // Would survive the biggest blocker's swing.
      if ((a.toughness - a.damage) > biggest.power) return true;
      // Would kill the biggest blocker.
      if (a.power >= (biggest.toughness - biggest.damage)) return true;
      // Pure suicide — skip.
      return false;
    });
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
    if (!hasUsefulTarget(match, effect, controller)) return false;
  }
  return true;
}

// Like "has any valid target" but also screens out targets the effect couldn't
// do anything to (e.g., healing an undamaged creature — legal target, wasted cast).
function hasUsefulTarget(match, effect, controller) {
  for (const p of match.players) {
    if (isValidTarget(p, effect.target, match, controller) && isUsefulTarget(effect, p, controller)) return true;
    for (const c of p.battlefield.cards) {
      if (isValidTarget(c, effect.target, match, controller) && isUsefulTarget(effect, c, controller)) return true;
    }
  }
  return false;
}

// Effect-specific "would this target actually benefit from / suffer from this effect?"
function isUsefulTarget(effect, target, controller) {
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
  return true;
}
