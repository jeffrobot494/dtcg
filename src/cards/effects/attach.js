import { defineEffect } from './registry.js';

// Attaches the source equipment to a target creature. Replaces any prior
// attachment (re-equipping moves the equipment).
defineEffect('attach', (match, ctx, _params) => {
  const target = ctx.target;
  if (!target?.isCreature || target.zone?.name !== 'battlefield') return;
  ctx.source.attachedTo = target;
  match.notify(`${ctx.source.name} is now attached to ${target.name}.`);
});
