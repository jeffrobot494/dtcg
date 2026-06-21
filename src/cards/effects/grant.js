import { defineEffect } from './registry.js';

// Grants one or more keywords to a creature until end of turn.
// params: { keywords: [...] }
defineEffect('grant_keywords', (match, ctx, params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  const keywords = params.keywords ?? [];
  for (const k of keywords) target.grantedKeywords.add(k);
  match.notify(`${ctx.source.name} grants ${keywords.join(', ')} to ${target.name}.`);
});

// Adjusts a creature's power and/or toughness until end of turn.
// params: { power?: number, toughness?: number }
// Note: negative toughness can kill a creature (SBA will catch it).
defineEffect('modify_stats', (match, ctx, params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  const dP = params.power ?? 0;
  const dT = params.toughness ?? 0;
  target.grantedPower += dP;
  target.grantedToughness += dT;
  const pSign = dP >= 0 ? '+' : '';
  const tSign = dT >= 0 ? '+' : '';
  match.notify(`${ctx.source.name} gives ${target.name} ${pSign}${dP}/${tSign}${dT}.`);
});
