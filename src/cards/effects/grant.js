import { defineEffect } from './registry.js';
import { isValidTarget } from '../../engine/Targeting.js';

// Grants one or more keywords to a creature until end of turn.
// params: { keywords: [...] }
defineEffect('grant_keywords', (match, ctx, params) => {
  const target = ctx.target;
  if (!target || target.isPlayer) return;
  const keywords = params.keywords ?? [];
  for (const k of keywords) target.grantedKeywords.add(k);
  match.notify(`${ctx.source.name} grants ${keywords.join(', ')} to ${target.name}.`);
});

// Grants keywords to every battlefield card matching `filter`, until end of
// turn. Mirrors `damage_to_all`. `ctx.controller` resolves "you control" filters.
// params: { keywords: [...], filter }
defineEffect('grant_keywords_to_all', (match, ctx, params) => {
  const keywords = params.keywords ?? [];
  const filter = params.filter;
  const targets = [];
  for (const p of match.players) {
    for (const c of p.battlefield.cards) {
      if (isValidTarget(c, filter, match, ctx.controller)) targets.push(c);
    }
  }
  for (const t of targets) {
    for (const k of keywords) t.grantedKeywords.add(k);
  }
  match.notify(`${ctx.source.name} grants ${keywords.join(', ')} to ${targets.length} creatures.`);
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
