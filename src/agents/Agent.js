// Agent is the seam between the engine and whoever (UI or AI) makes decisions.
// All methods return Promises so the engine can `await` a choice regardless of
// whether it resolves immediately (AI) or on a UI click (human).
//
// Methods:
//   choosePriorityAction(match) -> { type: 'pass' | 'play_land' | 'tap_for_mana' | 'cast', card? }
//   chooseTarget(match, filter, source, effect?, picks?) -> Card | MatchPlayer | null
//     effect is the per-effect spec ({id, target, ...}) so the agent can make
//     id-aware choices (e.g., AI prefers most-damaged creature for heals).
//     picks is the list of targets already chosen for this effect (only used
//     for X-target effects); agents should avoid returning a duplicate.
//   chooseXValue(match, card, max) -> integer in [0, max] | null (null = cancel cast)
//   declareAttackers(match) -> Card[]
//   declareBlockers(match, attackers) -> [{ attacker, blocker }]
//   confirmTrigger(match, source, trigger) -> boolean
//     For optional ("you may") triggers. Cost (if any) is paid by the engine
//     only on a true return.
//
// Future additions: declareCost (additional life cost), chooseMode, mulligan.

export class Agent {
  async choosePriorityAction(match) { throw new Error('not implemented'); }
  async chooseTarget(match, filter, source, effect, picks) { throw new Error('not implemented'); }
  async chooseXValue(match, card, max) { throw new Error('not implemented'); }
  async declareAttackers(match) { throw new Error('not implemented'); }
  async declareBlockers(match, attackers) { throw new Error('not implemented'); }
  async confirmTrigger(match, source, trigger) { throw new Error('not implemented'); }
}
