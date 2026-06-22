import { defineEffect } from './registry.js';

// Adds typed mana to the controller's pool.
// params: { mana: { R?: number, B?: number, generic?: number } }
defineEffect('add_mana', (match, ctx, params) => {
  const player = ctx.controller;
  const produced = params.mana ?? {};
  for (const [color, amount] of Object.entries(produced)) {
    player.manaPool[color] = (player.manaPool[color] ?? 0) + amount;
  }
  const desc = Object.entries(produced).map(([c, n]) => `${n}${c}`).join(' ');
  match.notify(`${ctx.source.name} adds ${desc} to ${player.name}'s pool.`);
});
