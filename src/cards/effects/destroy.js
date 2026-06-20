import { defineEffect } from './registry.js';

defineEffect('destroy_target', (match, ctx, _params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  if (target.zone?.name !== 'battlefield') return;
  match.movePermanentToGraveyard(target);
  match.notify(`${ctx.source.name} destroys ${target.name}.`);
});
