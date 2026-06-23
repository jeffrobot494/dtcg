import { defineEffect } from './registry.js';

// Registers a delayed trigger for the caster's end step that draws cards
// equal to the combat damage their opponent took this turn.
defineEffect('register_scars_trigger', (match, ctx, _params) => {
  match.pendingDelayedTriggers.push({
    controller: ctx.controller,
    phase: 'end',
    source: ctx.source,
    computeEffects: () => {
      const opp = match.opponentOf(ctx.controller);
      return [{ id: 'draw_cards', amount: opp.combatDamageTakenThisTurn }];
    },
  });
  match.notify(`${ctx.source.name} will trigger at ${ctx.controller.name}'s end step.`);
});
