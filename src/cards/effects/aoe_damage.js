import { defineEffect } from './registry.js';
import { isValidTarget } from '../../engine/Targeting.js';

defineEffect('damage_to_all', (match, ctx, params) => {
  const amount = params.amount ?? 0;
  const filter = params.filter;
  // Snapshot the list before dealing damage so iteration is stable.
  const targets = [];
  for (const p of match.players) {
    for (const c of p.battlefield.cards) {
      if (isValidTarget(c, filter, match)) targets.push(c);
    }
  }
  for (const t of targets) {
    match.dealDamage(ctx.source, t, amount);
  }
});
