import { defineEffect } from './registry.js';
import { resolveAmount } from './util.js';
import { Card } from '../Card.js';

function makeTokenDef({ name, type = 'creature', power = 0, toughness = 0, keywords = [], color }) {
  const slug = name.toLowerCase().replace(/\s+/g, '_');
  return {
    id: `__token_${slug}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    type,
    color,
    power,
    toughness,
    cost: null,
    keywords,
    isToken: true,
  };
}

function spawnToken(match, controller, def) {
  const token = new Card(def, controller);
  controller.battlefield.add(token);
  if (token.isCreature) token.summoningSick = true;
  return token;
}

// Spawns N tokens from a fixed template.
// params: { template: {name, type, power, toughness, keywords?, color?}, count: number | 'x' | 'half_x' }
defineEffect('create_tokens', (match, ctx, params) => {
  const count = resolveAmount(params.count, ctx);
  if (count <= 0) return;
  const tmpl = params.template ?? { name: 'Token', power: 1, toughness: 1 };
  for (let i = 0; i < count; i++) {
    spawnToken(match, ctx.controller, makeTokenDef(tmpl));
  }
  match.notify(`${ctx.source.name} creates ${count} ${tmpl.name}${count !== 1 ? 's' : ''}.`);
});

// Press Into Service: exile one target creature card from a graveyard and
// create one token from a fixed template. Combined into a single effect so
// the token count matches actual exiles (not the X paid).
// params: { template: {...} }
defineEffect('exile_and_create_token', (match, ctx, params) => {
  const target = ctx.target;
  if (!target?.isCreature || target.zone?.name !== 'graveyard') return;
  target.zone.remove(target);
  target.owner.exile.add(target);
  const tmpl = params.template ?? { name: 'Token', power: 1, toughness: 1 };
  spawnToken(match, ctx.controller, makeTokenDef(tmpl));
  match.notify(`${ctx.source.name} exiles ${target.name} and creates a ${tmpl.name}.`);
});

// Honor with Immortality: exiles the target creature card from a graveyard
// and creates a "golem" token copying its name, power, and toughness but with
// no abilities/triggers/keywords.
defineEffect('exile_and_golem', (match, ctx, _params) => {
  const target = ctx.target;
  if (!target?.isCreature || target.zone?.name !== 'graveyard') return;
  // Exile
  target.zone.remove(target);
  target.owner.exile.add(target);
  // Create golem token under our control
  const golemDef = makeTokenDef({
    name: target.def.name,
    power: target.def.power ?? 0,
    toughness: target.def.toughness ?? 0,
    color: target.def.color,
  });
  spawnToken(match, ctx.controller, golemDef);
  match.notify(`${ctx.source.name} exiles ${target.name} and creates a golem.`);
});
