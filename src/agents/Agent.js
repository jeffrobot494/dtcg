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
//   chooseMulligan(match, player, mulliganCount) -> 'keep' | 'mulligan'
//     mulliganCount is how many mulligans the player has already taken on
//     this opening; 0 the first time it's asked.
//   chooseBottomCards(match, player, count) -> Card[]
//     After a keep with mulliganCount > 0, the player puts that many cards
//     from hand on the bottom of their library (in returned order).
//
// Future additions: declareCost (additional life cost), chooseMode.

export class Agent {
  async choosePriorityAction(match) { throw new Error('not implemented'); }
  async chooseTarget(match, filter, source, effect, picks) { throw new Error('not implemented'); }
  async chooseXValue(match, card, max) { throw new Error('not implemented'); }
  async declareAttackers(match) { throw new Error('not implemented'); }
  async declareBlockers(match, attackers) { throw new Error('not implemented'); }
  async confirmTrigger(match, source, trigger) { throw new Error('not implemented'); }
  async chooseDiscard(match) { throw new Error('not implemented'); }
  async chooseMulligan(match, player, mulliganCount) { throw new Error('not implemented'); }
  async chooseBottomCards(match, player, count) { throw new Error('not implemented'); }
}
