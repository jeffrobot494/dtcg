import { defineEffect } from './registry.js';
import { resolveAmount } from './util.js';

// Card-specific: deals damage and applies a persistent modifier to the same
// target. Creature → can't regenerate this turn. Player → can't gain life
// for the rest of the game. Bundled because the engine doesn't support two
// effects sharing one target (see CLAUDE.md "option zero").
defineEffect('incinerate', (match, ctx, params) => {
  const target = ctx.target;
  if (!target) return;
  match.dealDamage(ctx.source, target, resolveAmount(params.amount, ctx));
  if (target.isPlayer) {
    target.cantGainLifeForever = true;
    match.notify(`${target.name} can't gain life for the rest of the game.`);
  } else if (target.isCreature) {
    target.cantRegenThisTurn = true;
    match.notify(`${target.name} can't regenerate this turn.`);
  }
});
