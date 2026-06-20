import { defineEffect } from './registry.js';

defineEffect('deal_damage', (match, ctx, params) => {
  match.dealDamage(ctx.source, ctx.target, params.amount ?? 0);
});
