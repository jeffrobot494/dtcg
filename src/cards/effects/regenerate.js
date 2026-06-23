import { defineEffect } from './registry.js';

// Adds a one-shot regeneration shield to the target (defaults to source for
// self-regen cards like Grandfather Abas). When the creature would die, SBA
// consumes one shield instead: damage and markedForDeath cleared, tapped,
// stays on the battlefield. Shields expire at end of turn.
defineEffect('add_regen_shield', (match, ctx, _params) => {
  const target = ctx.target ?? ctx.source;
  if (!target?.isCreature) return;
  target.regenerationShields = (target.regenerationShields ?? 0) + 1;
  match.notify(`${target.name} gains a regeneration shield.`);
});
