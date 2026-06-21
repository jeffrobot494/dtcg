// Generates human-readable rules text from a structured card definition.
// Used by the tooltip; a single source of truth that stays in sync with behavior.
import { formatCost } from '../engine/Cost.js';

export function describeCard(def) {
  const out = [];
  out.push(`<div class="tt-name">${escape(def.name)}</div>`);

  let typeLine = capitalize(def.type);
  if (def.subtype) typeLine += ` — ${capitalize(def.subtype)}`;
  if (def.color)   typeLine += `  ·  ${def.color}`;
  out.push(`<div class="tt-type">${escape(typeLine)}</div>`);

  const costText = formatCost(def.cost);
  if (costText) out.push(`<div class="tt-cost">Cost: ${costText}</div>`);
  if (def.type === 'creature') {
    out.push(`<div class="tt-stats">${def.power}/${def.toughness}</div>`);
  }

  const rules = [];
  if (def.cost?.x === 'life') {
    rules.push('Additional cost: pay X life.');
  }
  if (def.keywords?.length) {
    rules.push(def.keywords.map(capitalize).join(', '));
  }
  for (const eff of def.effects ?? [])    rules.push(describeEffect(eff));
  for (const trig of def.triggers ?? [])  rules.push(describeTrigger(trig));
  for (const ab of def.abilities ?? [])   rules.push(describeAbility(ab));
  if (def.partial) {
    rules.push('<em style="color:#fa6">(partial implementation)</em>');
  }
  if (rules.length > 0) {
    out.push(`<div class="tt-rules">${rules.map(r => `<div>${r}</div>`).join('')}</div>`);
  }
  return out.join('');
}

function describeAmount(amount) {
  if (amount === 'x')      return 'X';
  if (amount === 'half_x') return 'half X (rounded up)';
  return amount;
}

function describeEffect(eff) {
  switch (eff.id) {
    case 'deal_damage':
      return `Deal ${describeAmount(eff.amount)} damage to ${describeFilter(eff.target)}.`;
    case 'remove_damage':
      return `Heal ${describeAmount(eff.amount)} damage from ${describeFilter(eff.target)}.`;
    case 'grant_keywords': {
      const ks = (eff.keywords ?? []).map(capitalize).join(' and ');
      return `${capitalize(describeFilter(eff.target))} gains ${ks} until end of turn.`;
    }
    case 'modify_stats': {
      const p = eff.power ?? 0, t = eff.toughness ?? 0;
      const pSign = p >= 0 ? '+' : '', tSign = t >= 0 ? '+' : '';
      return `${capitalize(describeFilter(eff.target))} gets ${pSign}${p}/${tSign}${t} until end of turn.`;
    }
    case 'damage_to_all':
      return `Deal ${describeAmount(eff.amount)} damage to ${describeAoeFilter(eff.filter)}.`;
    case 'destroy_target':
      return `Destroy ${describeFilter(eff.target)}.`;
    case 'draw_cards':
      return `Draw ${eff.amount} ${eff.amount === 1 ? 'card' : 'cards'}.`;
    case 'lose_life':
      return `${describeWho(eff.who)} loses ${eff.amount} life.`;
    case 'gain_life':
      return `${describeWho(eff.who)} gains ${eff.amount} life.`;
  }
  return `(unknown effect: ${eff.id})`;
}

function describeTrigger(trig) {
  const prefix = describeTriggerPrefix(trig);
  const body = (trig.effects ?? []).map(describeEffect).join(' ');
  return `${prefix} ${body}`;
}

function describeTriggerPrefix(trig) {
  const cond = trig.condition?.type ?? 'any';
  if (trig.event === 'creature_dies') {
    if (cond === 'self')        return 'When this creature dies,';
    if (cond === 'you_control') return 'Whenever a creature you control dies,';
    return 'Whenever a creature dies,';
  }
  return `When ${trig.event} (${cond}):`;
}

function describeAbility(ab) {
  if (ab.kind === 'mana') return `{T}: Add ${ab.produces?.mana ?? 1} mana.`;
  return '(activated ability)';
}

function describeFilter(filter) {
  switch (filter?.type) {
    case 'any':                     return 'any target';
    case 'player':                  return 'target player';
    case 'creature':                return 'target creature';
    case 'creature_without_flying': return 'target creature without Flying';
    case 'non_black_creature':      return 'target non-black creature';
    case 'land':                    return 'target land';
    case 'artifact':                return 'target artifact';
  }
  return 'target';
}

function describeAoeFilter(filter) {
  switch (filter?.type) {
    case 'creature':                return 'all creatures';
    case 'creature_without_flying': return 'all creatures without Flying';
    case 'non_black_creature':      return 'all non-black creatures';
    case 'land':                    return 'all lands';
    case 'artifact':                return 'all artifacts';
  }
  return 'all matching permanents';
}

function describeWho(who) {
  switch (who) {
    case 'opponent': return 'Opponent';
    case 'target':   return 'Target';
    case 'controller':
    default:         return 'You';
  }
}

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function escape(s) {
  return String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
