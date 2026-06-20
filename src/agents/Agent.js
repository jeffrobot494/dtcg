// Agent is the seam between the engine and whoever (UI or AI) makes decisions.
// All methods return Promises so the engine can `await` a choice regardless of
// whether it resolves immediately (AI) or on a UI click (human).
//
// Methods:
//   choosePriorityAction(match) -> { type: 'pass' | 'play_land' | 'tap_for_mana' | 'cast', card? }
//   chooseTarget(match, filter, source) -> Card | MatchPlayer | null (null = cancel cast)
//   declareAttackers(match) -> Card[]
//   declareBlockers(match, attackers) -> [{ attacker, blocker }]
//
// Future additions: chooseMode, declareCost (X, additional life), mulligan.

export class Agent {
  async choosePriorityAction(match) { throw new Error('not implemented'); }
  async chooseTarget(match, filter, source) { throw new Error('not implemented'); }
  async declareAttackers(match) { throw new Error('not implemented'); }
  async declareBlockers(match, attackers) { throw new Error('not implemented'); }
}
