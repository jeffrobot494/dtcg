import { defineEffect } from './registry.js';

// Moves the target card from its current zone to its owner's exile.
defineEffect('exile_target', (match, ctx, _params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  if (!target.zone) return;
  target.zone.remove(target);
  target.owner.exile.add(target);
  match.notify(`${ctx.source.name} exiles ${target.name}.`);
});
