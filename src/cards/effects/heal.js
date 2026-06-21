import { defineEffect } from './registry.js';
import { resolveAmount } from './util.js';

// Removes persistent damage from a creature ("healing" — creatures don't have
// a life stat). Floors at 0; reports the actual amount healed.
defineEffect('remove_damage', (match, ctx, params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  const amount = resolveAmount(params.amount, ctx);
  if (amount <= 0) return;
  const before = target.damage;
  target.damage = Math.max(0, target.damage - amount);
  const healed = before - target.damage;
  if (healed > 0) {
    match.notify(`${ctx.source.name} heals ${healed} damage from ${target.name}.`);
  } else {
    match.notify(`${ctx.source.name}: ${target.name} has no damage to heal.`);
  }
});
