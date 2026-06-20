import { defineEffect } from './registry.js';

defineEffect('draw_cards', (match, ctx, params) => {
  const player = ctx.controller;
  const n = params.amount ?? 1;
  for (let i = 0; i < n; i++) {
    if (match.gameOver) return;
    match.drawCard(player);
  }
});
