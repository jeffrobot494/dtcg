import { defineEffect } from './registry.js';
import { resolveAmount } from './util.js';

// Adds N counters of a given type to the effect's source card. No target —
// used by ETB triggers like Simulacrum's "enters with X +1/+0 counters".
// params: { counter: '+1/+1' | '+1/+0' | '-1/+1', amount: number | 'x' | 'half_x' }
defineEffect('put_counter_on_self', (match, ctx, params) => {
  const src = ctx.source;
  if (!src) return;
  const amount = resolveAmount(params.amount, ctx);
  if (amount <= 0) return;
  const counter = params.counter ?? '+1/+1';
  src.counters[counter] = (src.counters[counter] ?? 0) + amount;
  match.notify(`${src.name} gets ${amount} ${counter} counter${amount !== 1 ? 's' : ''}.`);
});
