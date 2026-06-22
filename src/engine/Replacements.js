// Replacement effects: modify or replace events BEFORE they happen.
// Used for damage prevention (Smokeweaver), regenerate (future), etc.
//
// Shape on a card def:
//   replacements: [
//     { event: 'damage_dealt',
//       condition: { type: 'damage_to_you_control' },
//       modify: { type: 'reduce_damage', amount: 1 } }
//   ]
//
// Event objects carry a mutable `amount` (and possibly other fields) that
// replacements mutate in place.

export function matchesReplacement(replacement, source, event) {
  if (replacement.event !== event.type) return false;
  const cond = replacement.condition?.type ?? 'any';
  if (event.type === 'damage_dealt') {
    if (cond === 'damage_to_you_control') {
      return !!event.target
        && !event.target.isPlayer
        && event.target.isCreature
        && event.target.controller === source.controller;
    }
    if (cond === 'any') return true;
  }
  return false;
}

export function applyReplacement(replacement, event) {
  const m = replacement.modify;
  if (!m) return;
  if (m.type === 'reduce_damage') {
    const reduce = m.amount ?? 0;
    const before = event.amount;
    event.amount = Math.max(0, event.amount - reduce);
    event.prevented = (event.prevented ?? 0) + (before - event.amount);
  }
}
