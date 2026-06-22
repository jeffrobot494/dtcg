// Triggered ability infrastructure: condition matching + scope selection.
//
// A trigger lives on a card definition:
//   triggers: [
//     {
//       event: 'creature_dies',
//       condition: { type: 'self' | 'you_control' | 'any' },
//       effects: [...]   // same shape as spell effects
//     }
//   ]
//
// Match calls `scopeForEvent` to know which cards to scan for matching triggers,
// then calls `matchesCondition` per (trigger, source, payload) tuple.

export function matchesCondition(trigger, source, payload) {
  const cond = trigger.condition ?? { type: 'any' };
  switch (cond.type) {
    case 'self':
      return payload?.card === source;
    case 'you_control':
      return payload?.card?.controller === source.controller;
    case 'your_phase':
      // Fires on the named phase, but only when it's this source's controller's turn.
      return payload?.player === source.controller && payload?.phase === cond.phase;
    case 'any':
      return true;
  }
  return false;
}

// Cards eligible to host a trigger response for this event.
// If the event carries an explicit `scope` (a snapshot of the battlefield taken
// BEFORE the event fired), use that — important for simultaneous deaths so
// each dying creature's triggers see all the others. Otherwise fall back to
// the current battlefield. For creature_dies, the dying card itself is always
// included so self-dies triggers fire (LKI).
export function scopeForEvent(match, eventName, payload) {
  let scope;
  if (payload?.scope) {
    scope = [...payload.scope];
  } else {
    scope = [];
    for (const p of match.players) scope.push(...p.battlefield.cards);
  }
  if (eventName === 'creature_dies' && payload?.card && !scope.includes(payload.card)) {
    scope.push(payload.card);
  }
  return scope;
}
