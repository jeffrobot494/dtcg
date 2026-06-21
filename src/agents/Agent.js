// Agent is the seam between the engine and whoever (UI or AI) makes decisions.
// All methods return Promises so the engine can `await` a choice regardless of
// whether it resolves immediately (AI) or on a UI click (human).
//
// Methods:
//   choosePriorityAction(match) -> { type: 'pass' | 'play_land' | 'tap_for_mana' | 'cast', card? }
//   chooseTarget(match, filter, source, effect?) -> Card | MatchPlayer | null (null = cancel cast)
//     effect is the per-effect spec ({id, target, ...}) so the agent can make
//     id-aware choices (e.g., AI prefers most-damaged creature for heals).
//   chooseXValue(match, card, max) -> integer in [0, max] | null (null = cancel cast)
//   declareAttackers(match) -> Card[]
//   declareBlockers(match, attackers) -> [{ attacker, blocker }]
//
// Future additions: declareCost (additional life cost), chooseMode, mulligan.

export class Agent {
  async choosePriorityAction(match) { throw new Error('not implemented'); }
  async chooseTarget(match, filter, source, effect) { throw new Error('not implemented'); }
  async chooseXValue(match, card, max) { throw new Error('not implemented'); }
  async declareAttackers(match) { throw new Error('not implemented'); }
  async declareBlockers(match, attackers) { throw new Error('not implemented'); }
}
