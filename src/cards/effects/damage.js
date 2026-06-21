import { defineEffect } from './registry.js';
import { resolveAmount } from './util.js';

defineEffect('deal_damage', (match, ctx, params) => {
  match.dealDamage(ctx.source, ctx.target, resolveAmount(params.amount, ctx));
});
