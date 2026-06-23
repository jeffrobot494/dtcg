import { defineEffect } from './registry.js';

// Returns the effect's source card (typically from its own dies trigger, so
// it's already in the graveyard via LKI) to its owner's hand. No target.
defineEffect('return_self_to_hand', (match, ctx, _params) => {
  const src = ctx.source;
  if (!src?.zone) return;
  src.zone.remove(src);
  src.owner.hand.add(src);
  match.notify(`${src.name} returns to ${src.owner.name}'s hand.`);
});

// Returns a card from a graveyard to its owner's hand.
defineEffect('return_to_hand', (match, ctx, _params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  if (target.zone?.name !== 'graveyard') return;
  target.zone.remove(target);
  target.owner.hand.add(target);
  match.notify(`${ctx.source.name} returns ${target.name} to ${target.owner.name}'s hand.`);
});

// Returns a card from a graveyard to the battlefield under the controller of
// the resolving spell/ability. Optionally puts a counter on it
// (params.counter = '+1/+1' | '-1/+1' | etc., params.amount = number).
defineEffect('return_to_battlefield', (match, ctx, params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  if (target.zone?.name !== 'graveyard') return;
  target.zone.remove(target);
  ctx.controller.battlefield.add(target);
  target.controller = ctx.controller;
  if (target.isCreature) target.summoningSick = true;
  if (params.counter && params.amount) {
    target.counters[params.counter] = (target.counters[params.counter] ?? 0) + params.amount;
    match.notify(`${ctx.source.name} returns ${target.name} with ${params.amount} ${params.counter} counter.`);
  } else {
    match.notify(`${ctx.source.name} returns ${target.name} to the battlefield.`);
  }
});
