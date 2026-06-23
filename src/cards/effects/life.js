import { defineEffect } from './registry.js';

// who: 'controller' (default), 'opponent', or 'target' (uses ctx.target)
function resolveSubject(ctx, who) {
  switch (who) {
    case 'opponent': return ctx.match?.opponentOf(ctx.controller) ?? null;
    case 'target':   return ctx.target;
    case 'controller':
    default:         return ctx.controller;
  }
}

defineEffect('lose_life', (match, ctx, params) => {
  ctx.match = match;
  const subject = resolveSubject(ctx, params.who);
  if (!subject?.isPlayer) return;
  const amount = params.amount ?? 0;
  subject.life -= amount;
  match.notify(`${subject.name} loses ${amount} life.`);
});

defineEffect('gain_life', (match, ctx, params) => {
  ctx.match = match;
  const subject = resolveSubject(ctx, params.who);
  if (!subject?.isPlayer) return;
  if (subject.cantGainLifeForever) {
    match.notify(`${subject.name} can't gain life.`);
    return;
  }
  const amount = params.amount ?? 0;
  subject.life += amount;
  match.notify(`${subject.name} gains ${amount} life.`);
});
