import { defineEffect } from './registry.js';
import { resolveAmount } from './util.js';

// Drain Life: deals damage to a creature or player, then drains life equal
// to that damage — capped by the target's remaining capacity (toughness for
// a creature, life for a player). Casting for X=10 on a 1/1 only drains 1.
// Cap is snapshot before damage so overkill / kills are handled cleanly.
defineEffect('drain_life', (match, ctx, params) => {
  const target = ctx.target;
  if (!target) return;
  const intended = resolveAmount(params.amount, ctx);
  if (intended <= 0) return;

  const cap = target.isPlayer
    ? Math.max(0, target.life)
    : Math.max(0, target.toughness - target.damage);

  match.dealDamage(ctx.source, target, intended);

  const drained = Math.min(intended, cap);
  if (drained > 0 && !ctx.controller.cantGainLifeForever) {
    ctx.controller.life += drained;
    match.notify(`${ctx.controller.name} drains ${drained} life from ${target.name}.`);
  }
});
