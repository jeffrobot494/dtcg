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
  if (def.staticBuff) {
    const p = def.staticBuff.power ?? 0, t = def.staticBuff.toughness ?? 0;
    const pSign = p >= 0 ? '+' : '', tSign = t >= 0 ? '+' : '';
    let line = `Equipped creature gets ${pSign}${p}/${tSign}${t}`;
    if (def.staticBuff.keywords?.length) {
      line += ` and gains ${def.staticBuff.keywords.map(capitalize).join(', ')}`;
    }
    rules.push(line + '.');
  }
  if (def.keywords?.length) {
    rules.push(def.keywords.map(capitalize).join(', '));
  }
  for (const eff of def.effects ?? [])    rules.push(describeEffect(eff));
  for (const trig of def.triggers ?? [])  rules.push(describeTrigger(trig));
  for (const ab of def.abilities ?? [])   rules.push(describeAbility(ab));
  for (const rep of def.replacements ?? []) rules.push(describeReplacement(rep));
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
    case 'add_mana': {
      const parts = Object.entries(eff.mana ?? {})
        .map(([c, n]) => `{${c}}`.repeat(n))
        .join('');
      return `Add ${parts || 'no'} mana.`;
    }
    case 'exile_target': {
      const count = eff.target?.count === 'x' ? 'X' : '';
      return `Exile ${count ? count + ' ' : ''}${describeFilter(eff.target)}${count ? 's' : ''}.`;
    }
    case 'exile_and_golem':
      return `Exile ${describeFilter(eff.target)} and create a golem (a copy with the same power and toughness but no abilities).`;
    case 'create_tokens': {
      const n = describeAmount(eff.count);
      const t = eff.template ?? {};
      const stats = t.power != null ? ` ${t.power}/${t.toughness}` : '';
      return `Create ${n}${stats} ${t.name}${n === 'X' || (typeof n === 'number' && n !== 1) ? 's' : ''}.`;
    }
    case 'return_to_hand': {
      const count = eff.target?.count === 'x' ? 'X ' : '';
      return `Return ${count}${describeFilter(eff.target)} to ${count ? 'your hand' : "its owner's hand"}.`;
    }
    case 'return_to_battlefield': {
      let s = `Return ${describeFilter(eff.target)} to the battlefield`;
      if (eff.counter && eff.amount) {
        s += ` with ${eff.amount} ${eff.counter} counter`;
      }
      return s + '.';
    }
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
  if (trig.event === 'creature_attacks') {
    if (cond === 'self')        return 'When this creature attacks,';
    if (cond === 'you_control') return 'Whenever a creature you control attacks,';
    return 'Whenever a creature attacks,';
  }
  if (trig.event === 'phase_begins') {
    const labels = {
      upkeep: 'upkeep', draw: 'draw step',
      main1: 'first main phase', combat: 'combat',
      main2: 'second main phase', end: 'end step',
    };
    const ph = labels[trig.condition?.phase] ?? trig.condition?.phase ?? 'phase';
    if (cond === 'your_phase') return `At the beginning of your ${ph},`;
    return `At the beginning of each ${ph},`;
  }
  return `When ${trig.event} (${cond}):`;
}

function describeReplacement(rep) {
  if (rep.event === 'damage_dealt') {
    let prefix = 'When damage would be dealt';
    if (rep.condition?.type === 'damage_to_you_control') {
      prefix = 'Whenever a source would deal damage to a creature you control';
    }
    if (rep.modify?.type === 'reduce_damage') {
      return `${prefix}, prevent ${rep.modify.amount} of that damage.`;
    }
  }
  return '(unknown replacement effect)';
}

function describeAbility(ab) {
  if (ab.kind === 'mana') {
    const produced = Object.entries(ab.produces ?? {})
      .map(([c, n]) => `{${c}}`.repeat(n))
      .join('');
    return `${formatActivationCost(ab.cost)}: Add ${produced || '?'}.`;
  }
  if (ab.kind === 'activated') {
    // Special-case "Equip N": a sole attach effect renders as "Equip {N}".
    if (ab.effects?.length === 1 && ab.effects[0].id === 'attach') {
      return `Equip ${formatActivationCost(ab.cost)}`;
    }
    const costTxt = formatActivationCost(ab.cost);
    const effectsTxt = (ab.effects ?? []).map(describeEffect).join(' ');
    return `${costTxt}: ${effectsTxt}`;
  }
  return '(unknown ability)';
}

function formatActivationCost(cost) {
  if (!cost) return '0';
  const parts = [];
  if (cost.mana) parts.push(formatCostInline(cost.mana));
  if (cost.tap) parts.push('{T}');
  return parts.join(', ') || '0';
}

function formatCostInline(manaCost) {
  // Like formatCost from Cost.js, but reuse to keep one source of truth.
  return formatCost(manaCost);
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
