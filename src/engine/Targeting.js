// Target filter validation. Filters describe what's a legal target.
// Extend `filters` as new card mechanics demand new selectors.

const filters = {
  any: t => isPlayer(t) || (isCreatureOnBattlefield(t)),
  player: t => isPlayer(t),
  creature: t => isCreatureOnBattlefield(t),
  creature_without_flying: t =>
    isCreatureOnBattlefield(t) && !t.hasKeyword?.('flying'),
  non_black_creature: t =>
    isCreatureOnBattlefield(t) && t.def.color !== 'B',
  land: t => t?.isLand && t.zone?.name === 'battlefield',
  artifact: t => t?.isArtifact && t.zone?.name === 'battlefield',
};

function isPlayer(t) { return t?.isPlayer === true; }
function isCreatureOnBattlefield(t) {
  return t?.isCreature && t.zone?.name === 'battlefield';
}

export function isValidTarget(target, filter, match) {
  if (!target || !filter) return false;
  const fn = filters[filter.type];
  return fn ? !!fn(target, match, filter) : false;
}

export function describeFilter(filter) {
  switch (filter?.type) {
    case 'any':                     return 'any target (creature or player)';
    case 'player':                  return 'target player';
    case 'creature':                return 'target creature';
    case 'creature_without_flying': return 'target creature without flying';
    case 'non_black_creature':      return 'target non-black creature';
    case 'land':                    return 'target land';
    case 'artifact':                return 'target artifact';
  }
  return 'target';
}
