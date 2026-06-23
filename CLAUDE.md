# DTCG — project bootstrap

Browser-based digital TCG prototype. Functionally MtG with one rules quirk:
**damage on creatures persists across turns** while they're on the battlefield
(resets only when leaving). Vision is a single-player adventure where the player
is a sorcerer; persistent state (life, future equipment, deck) carries between
matches via singletons.

Tech: vanilla JS ES modules, no build step. Serve with `python -m http.server`
from the project root, open `http://localhost:8000`. Browser ES-module imports
need an HTTP origin — `file://` doesn't work.

---

## Architecture map

```
index.html, style.css
decks/                       — initial seed deck text file (Arena format)
src/
├── main.js                  — bootstrap: init DeckLibrary, mount SceneManager,
│                              register scenes, switch to Battle
├── scenes/
│   ├── SceneManager.js      — persistent nav bar + swappable scene-root
│   ├── BattleScene.js       — wraps BattleView; reads decks from DeckLibrary
│   └── DeckEditorScene.js   — GUI deck editor (click=add, right-click=remove)
├── state/
│   └── DeckLibrary.js       — singleton, localStorage-backed. list/get/create/
│                              update/delete + activeId / opponentId
├── engine/                  — DOM-free engine
│   ├── Match.js             — game loop (start → runTurn → phases). Owns
│   │                          stack, priority loop, _actionCast/_actionTap/
│   │                          _actionActivate, dealDamage, SBA, triggers
│   │                          queue, _firePhaseBegins, _vanishTokens.
│   │                          ALSO: movePermanentToGraveyard (resets state +
│   │                          unattaches equipment)
│   ├── Combat.js            — runCombatPhase: declare attackers, priority
│   │                          windows, declare blockers (with canBlock filter),
│   │                          damage. Fires creature_attacks events.
│   ├── Stack.js             — tiny stack data structure
│   ├── Cost.js              — canPayCost, payCost, maxXFromPool, formatCost,
│   │                          formatPool, manaValue, emptyPool. COLORS = R, B
│   ├── Targeting.js         — isValidTarget(target, filter, match, controller)
│   │                          + describeFilter. Filter registry.
│   ├── Triggers.js          — matchesCondition, scopeForEvent.
│   │                          Conditions: self, you_control, your_phase, any
│   └── Replacements.js      — matchesReplacement, applyReplacement.
│                              Events: damage_dealt. Modify types: reduce_damage.
├── agents/
│   ├── Agent.js             — interface (all methods async)
│   ├── HumanAgent.js        — stores pending request; UI reads & resolves
│   └── BasicAI.js           — heuristic AI. Currently controls Player 2.
│                              ~400 lines. _mainPhaseAction does play_land →
│                              free activations → playable list (spells +
│                              mana-cost activations) → tap → pass. Picks via
│                              valueOfCreature + per-effect-id heuristics.
├── cards/
│   ├── Card.js              — runtime card instance. Computed power/toughness
│   │                          from base + counters + grantedPower/Toughness +
│   │                          attached equipment staticBuff. hasKeyword checks
│   │                          def + grantedKeywords + equipment.
│   ├── Zone.js              — small zone (visibility, layout, cards array)
│   ├── data/                — one .js per card (default export). Plus index.js
│   │                          aggregating to `database` and exporting getCardDef
│   └── effects/             — registry + one .js per effect (see catalog below)
├── decks/
│   ├── parser.js            — Arena-style text → {id, name, cards} (seed only;
│   │                          editor stores structured)
│   └── DeckLoader.js        — Expands {id, name, cards} into Card instances
└── ui/
    ├── BattleView.js        — the battle scene's renderer. innerHTML-based
    │                          render() + attachHandlers(). Handles clicks,
    │                          tooltips, target-picker UI, X-input UI, combat
    │                          declaration. ~500 lines.
    ├── CardTooltip.js       — owns one floating tooltip DOM element
    └── cardText.js          — generates human-readable card text from struct
                                data (used by tooltip)
```

---

## Key design patterns

- **Engine is DOM-free.** Everything in `engine/` operates on data; rendering
  happens only in `ui/` and `scenes/`.
- **Agent interface is the UI/AI seam.** Same methods (`choosePriorityAction`,
  `chooseTarget`, `chooseXValue`, `declareAttackers`, `declareBlockers`) for
  human and AI; engine doesn't know which it's talking to.
- **Cards are data.** A card definition is a plain object with optional fields:
  `type`, `cost`, `power`, `toughness`, `keywords`, `effects`, `triggers`,
  `abilities`, `replacements`, `staticBuff`, `partial`. New cards are usually
  data-only changes.
- **Effects are a registry.** `defineEffect(id, fn)` per effect file; cards
  reference effects by `id` + params. ~95% of cards use only generic effects;
  see catalog below.
- **Targeting filters are a registry.** Card targets specify `{ type: 'name' }`;
  filter functions live in `engine/Targeting.js`.
- **Triggers, replacements** follow parallel shapes: condition match + payload.
- **Per-match EventBus is gone** — was unused; trigger system has its own queue
  (`_queueTriggersForEvent` / `_processPendingTriggers`).

---

## Card data shape (full reference)

```js
{
  id: 'card_id_snake_case',           // matches database key
  name: 'Display Name',
  type: 'creature' | 'instant' | 'sorcery' | 'artifact' | 'enchantment' | 'land',
  subtype: 'equipment',               // optional (only equipment uses this so far)
  color: 'R' | 'B',                   // color identity (filter use)
  cost: {                             // null for lands
    generic: 2,                       // generic mana
    R: 1, B: 0,                       // colored mana
    x: 'mana' | 'life',               // optional X cost
  },
  power: 2, toughness: 1,             // creatures only
  keywords: ['flying', 'lifelink'],   // 'flying', 'deathtouch', 'lifelink', 'trample'
  effects: [                          // resolved at cast time (for instants/sorceries)
    { id: 'deal_damage', amount: 1, target: { type: 'any' } },
  ],
  triggers: [                         // event-driven post-event triggers
    { event: 'creature_dies' | 'creature_attacks' | 'phase_begins',
      condition: { type: 'self' | 'you_control' | 'your_phase' | 'any',
                   phase: 'main1' /* for your_phase */ },
      effects: [ /* same shape as effects */ ] },
  ],
  abilities: [                        // mana abilities (lands) or activated
    { kind: 'mana', cost: { tap: true }, produces: { R: 1 } },
    { kind: 'activated', cost: { tap: true, mana: {...} }, speed: 'sorcery',
      effects: [ /* ... */ ] },
  ],
  replacements: [                     // modify events before they happen
    { event: 'damage_dealt',
      condition: { type: 'damage_to_you_control' },
      modify: { type: 'reduce_damage', amount: 1 } },
  ],
  staticBuff: {                       // equipment only — applies to attached
    power: 0, toughness: 2,
    keywords: ['flying'],
  },
  partial: true,                      // marker: implementation incomplete
}
```

**Stack item shape** (in `Match.stack.items`):
```js
{ type: 'spell' | 'triggered_ability' | 'activated_ability',
  source: Card, controller: MatchPlayer,
  targets: [[pick1, pick2], ...],     // one array per effect; [null] for no-target
  effects: [...],                     // resolved effect list
  x: number }                         // chosen X (if applicable)
```

---

## Effect catalog (16 effects, 15 generic + 1 card-specific)

| ID | Params | Used by |
|---|---|---|
| `deal_damage` | `amount`, `target` | Boil, Rockslide, Blaze, Drain Life, Fire Servant trig, Immolation Deathshaman trig, Pox trig, Fire Master ability, Fire Drake trig |
| `damage_to_all` | `amount`, `filter` | Erupt, Choking Fume |
| `destroy_target` | `target` | Destroy Artifact, Conflagration |
| `draw_cards` | `amount` | Beseech the Shadows |
| `lose_life` | `amount`, `who: 'controller'|'opponent'|'target'` | Beseech, Mighty Serpent trig, Walk on Coals trig |
| `gain_life` | `amount`, `who` | (defined, unused) |
| `remove_damage` | `amount` (supports `'half_x'`), `target` | Share Blood |
| `grant_keywords` | `keywords[]`, `target` | Touch of Zot, Cavern Drake trig, Fire Drake trig |
| `modify_stats` | `power`, `toughness`, `target` (until EOT) | Immolate |
| `attach` | `target` | Ancestral Armor, Aunaratha, Staff of Pain |
| `add_mana` | `mana: {R:1}` | Walk on Coals trig |
| `exile_target` | `target` | Press Into Service |
| `create_tokens` | `count`, `template` | Press Into Service |
| `return_to_hand` | `target` | Come Home |
| `return_to_battlefield` | `target`, optional `counter`+`amount` | Immortality |
| `exile_and_golem` | `target` | **Honor with Immortality only — card-specific. "Option zero."** |
| `add_regen_shield` | (no target = source) | Grandfather Abas. Adds a one-shot regen shield; SBA consumes one shield in lieu of dying. |

`amount` and `count` accept `'x'` or `'half_x'` to reference `ctx.x` (set at cast
time). Targets with `count: 'x'` collect X picks via the agent.

---

## Filter catalog

`any`, `player`, `creature`, `creature_you_control`, `creature_without_flying`,
`non_black_creature`, `land`, `artifact`, `creature_in_graveyard`,
`creature_in_your_graveyard`.

Filter signature: `(target, match, filter, controller) => boolean`. The
`controller` param is the spell/ability's controller — needed for "you control"
filters.

---

## Counter types (in Card.power/toughness getters)

- `+1/+1` — +1 power, +1 toughness
- `+1/+0` — +1 power, 0 toughness (Simulacrum future)
- `-1/+1` — −1 power, +1 toughness (Immortality writes this)

Counters reset when card leaves battlefield (`movePermanentToGraveyard` clears
them — MtG-correct).

---

## Implementation state (PDF cards)

**Fully implemented (36):** Mountain, Swamp, Mountain Warrior, Boil, Rockslide,
Blaze, Drain Life, Destroy Artifact, Conflagration, Erupt, Choking Fume,
Beseech the Shadows, Share Blood, Touch of Zot, Immolate, Rockeater,
Cavern Drake, Fire Drake, Fire Servant, Immolation Deathshaman, Mighty Serpent
of the Vale, Fire Master, Pox, Walk on Coals, Ancestral Armor, Aunaratha,
Press Into Service, Honor with Immortality, Come Home, Immortality,
Smokeweaver, Grandfather Abas, Incinerate, Terror, Dishonored Ghoul,
Staff of Pain, Read the Scars, Simulacrum.

**Test-only (not in PDF):** Normal Man (R, 1/1), Big Man (R, 2/2).

**Not yet implemented (2 cards / 2 systems):**
- **Giant Vampire Bat** — "Whenever you attack" (different condition) +
  optional ("may") + tap-as-cost on a trigger.
- **Grandmother Isa** — Static ability while in graveyard ("you may cast one
  creature spell from your graveyard each turn for +1 life"). Needs static
  abilities from non-battlefield zones.

---

## Key design decisions worth knowing

1. **"Option zero" for Honor with Immortality.** It uses a card-specific
   `exile_and_golem` effect rather than two separate effects sharing a target,
   because the engine doesn't currently support "two effects share one target"
   (card-level target). If a second card needs the pattern, refactor.

2. **Tokens vanish.** Created as Card instances with `def.isToken = true`.
   `movePermanentToGraveyard` sends them to graveyard so dies-triggers fire
   normally via LKI, then `_vanishTokens` in SBA removes them from any
   non-battlefield zone. They never accumulate.

3. **Combat priority windows.** runCombatPhase has windows after attackers,
   after blockers, and at combat begin (conditional — only spins a priority
   loop if a trigger queued something). The "still blocked" rule applies:
   blocked attacker stays blocked even if all blockers die mid-step, dealing
   no damage unless trample.

4. **End-of-turn cleanup** in `Match.runTurn`: clears mana pools, clears
   `grantedKeywords` / `grantedPower` / `grantedToughness` on all battlefield
   cards. Damage and tapped state are NOT cleared (damage persists per house
   rule; tapped clears at next untap step).

5. **Sorcery-speed casting.** `_actionCast` treats anything that isn't an
   instant as sorcery-speed (creatures, sorceries, artifacts, enchantments).
   Requires active player, empty stack, main1/main2.

6. **AI only acts on its own turn.** Passes immediately during opponent's
   priority windows. Future work to let AI cast in response. Heuristics for
   target picking and "is this useful" are effect-id-aware (see
   `_pickTarget` and `isUsefulTarget` in `BasicAI.js`).

7. **Deck library bootstrap.** On first run, fetches `decks/starter_red.txt`
   and seeds it as a structured deck. After that, all editing is GUI in the
   Decks scene; the .txt is dormant. Storage key: `dtcg.deckLibrary` in
   localStorage.

---

## Suggested next slices

In rough order of smallest/easiest first. Each is a self-contained slice.

### 1. Incinerate (small, ~30 lines)
Single card. Adds **persistent player-level modifier flags** on `MatchPlayer`:
- `cantRegenThisTurn: boolean` — reset at end-of-turn cleanup
- `cantGainLifeForever: boolean` — never reset

Card text: "Incinerate deals 2 damage to any target. If Incinerate targets a creature, that creature cannot regenerate this turn. If Incinerate targets a player, that player cannot gain life for the rest of the game."

Engine hooks:
- In SBA's regenerate check: also require `!target.controller.cantRegenThisTurn` to consume a shield
- In `dealDamage`'s lifelink branch and `gain_life` effect: short-circuit if `target.cantGainLifeForever`

New effect: `apply_persistent_modifier` with `flag` and `duration: 'turn' | 'game'`. Or just card-specific effect IDs.

Card targets `any` (creature or player); the effect dispatches based on `target.isPlayer`.

### 2. Terror (small, ~40 lines)
Single card. Adds the **Fear keyword** (a custom block-restriction) and the **mass keyword grant** pattern.

Fear in `engine/Combat.js#canBlock`:
```js
if (attacker.hasKeyword('fear') &&
    !blocker.def.color === 'B' &&
    !blocker.def.isToken /* golems */) return false;
```
(Note: per house rules, "golem" = any token. So blocker is legal if it's black OR a token.)

Effect: extend `grant_keywords` with optional `filter` param to apply to all matching battlefield cards, or add a new `grant_keywords_to_all` effect (mirrors `damage_to_all`).

Card: Terror — sorcery, {2}{B}, grants Fear to creatures you control until end of turn. (Card text in PDF says "Creatures you control gain Fear" without a duration — per the conventions memory, this is "until end of turn.")

### 3. Dishonored Ghoul (small-medium, ~60 lines)
Single card. Adds **optional triggers** + **alternative cost (pay X to do Y on resolution)**.

Card text: "When Dishonored Ghoul dies, you may pay 1 life to return it to your hand."

System pieces:
- Optional trigger flag: `trigger.optional: true`. When processing, prompt controller "use this trigger?" before queueing to stack.
- New `Agent.confirmTrigger(match, source, trigger)` returning boolean. HumanAgent shows a yes/no prompt in the controls panel. BasicAI applies a heuristic (yes when the cost is worth the effect — for Ghoul, almost always yes since 1 life for a card-back is great).
- Alt-cost-on-resolution: trigger effect can include a `cost: { life: 1 }` and an `optional` flag. If declined, effect doesn't fire. Or simpler: model as an optional trigger where the effect itself pays the life — easier with current systems.

Trigger shape:
```js
triggers: [
  { event: 'creature_dies',
    condition: { type: 'self' },
    optional: true,
    cost: { life: 1 },
    effects: [{ id: 'return_self_to_hand' }] }
]
```
New effect: `return_self_to_hand` moves ctx.source from graveyard to hand.

### 4. Staff of Pain trigger completion (medium, ~80 lines)
Completes the **Staff of Pain** partial. Needs **granted activated abilities** — equipped creature gains an activated ability while attached.

Mirrors granted keywords. Card has `staticBuff.grantedAbilities: [...]`. Card.js's `_attachedEquipment` getter is already there; activated-ability resolution would check both `card.def.abilities` and equipment-granted abilities.

Cleanup: Match.canActivate and BattleView's handlePriorityClick both iterate card.def.abilities — need a helper `getAllAbilities(card)` that combines def + granted. Then check in both call sites.

For Staff of Pain specifically: equipped creature gains `{T}: deal 1 damage to any target.`

### 5. Read the Scars (medium, ~80 lines)
Single card. Adds **delayed triggers** + **per-cast state tracking**.

Card text: "At the beginning of your next upkeep, draw cards equal to the number of creatures that died since you cast this spell."

System:
- Delayed trigger registry on Match: `pendingDelayedTriggers: [{ controller, phase, source, effects, registeredAt: turnNumber }]`
- Cast effect registers a delayed trigger keyed to controller's next upkeep
- When phase_begins fires, also check delayed-trigger registry; fire matching ones, remove
- Cross-time state: count of "creatures that died since cast." Match maintains a `creaturesDiedThisGame` counter (or per-controller); the cast snapshots the counter; the trigger reads delta

Simpler approximation: the cast snapshots `creaturesDiedThisGame` count; on next-upkeep firing, compute (current - snapshot) and draw that many.

Match needs `creaturesDiedThisGame` incremented in SBA wherever a creature dies. Tiny addition.

### 6. Simulacrum (medium, ~80 lines)
Single card. Combines **X life cost** (already have) + **ETB triggers** (new) + **conditional keyword grant** (new) + **counter writes on ETB** (sort of new — we have counters but not "card enters with X counters").

Card text: "As an additional cost to cast Simulacrum, pay X life. Simulacrum enters the battlefield with X +1/+0 counters. If X is 5 or more, Simulacrum also gains Flying."

System pieces:
- ETB triggers via `phase_begins`-style event `creature_etb` fired when creatures enter the battlefield (in `_actionCast` for creatures + `return_to_battlefield` effect + token spawn)
- New scope/condition for self-ETB: `event: 'creature_etb', condition: { type: 'self' }`
- New effect to write counters on the etb target: `put_counter` (parametric — we already have this concept inline in `return_to_battlefield`; extract as a standalone effect that reads `ctx.x` for amount)
- Conditional Flying: either an effect "if X >= 5, grant flying" (new conditional effect spec), or a static getter on Card that reads `def.conditionalKeywords` — e.g., `{ keyword: 'flying', when: { x: { gte: 5 } } }`. The `x` is stored on the card at creation? Simpler: store `xValue` on the Card instance when it's cast with X cost; conditional keyword check reads it.

### 7. Grandmother Isa (medium-large)
Single card. Adds **static abilities from non-battlefield zones**.

Card text: "As long as Grandmother Isa is in your graveyard, you may cast one creature spell from your graveyard on each of your turns. Pay 1 life in addition to their normal mana cost."

Hardest part: cast-from-graveyard mechanic, plus a per-turn limit, plus an additional life cost specifically on those casts. The "once per turn" limit needs a flag reset at start-of-turn. The casting machinery in `_actionCast` would need to accept hand-OR-graveyard as source zone when Isa enables it.

Significant engine change. Defer until other small ones are done.

### 8. Giant Vampire Bat (medium-large)
Single card. Combines **"whenever you attack" condition** (anyone you control attacks, not just self) + **optional trigger** + **tap-as-cost on a trigger**.

Trigger fires when controller declares attackers. Optional ("may"). Activation pays a tap on the source (Vampire Bat itself).

Needs: a new trigger condition that fires when controller's declare-attackers happens; optional triggers (see Dishonored Ghoul slice); tap-as-cost on trigger payment.

---

## Engine improvements worth considering (not card-specific)

- **AI casts on opponent's turn.** Currently AI passes immediately during opponent's priority windows. Add reactive casting (Boil in response to a threat, regen in response to combat damage). Unlocks AI usefully using Grandfather Abas's regenerate and reactive instants.
- **Mulligan.** Pre-game, let each player optionally redraw their opening hand (with one fewer card per mulligan).
- **Mana pool clears between phases.** Current rule has pool persist through all of a turn; standard MtG clears at each phase boundary. Small change, slight rules-correctness improvement.
- **Combat damage step priority window.** Triggers from combat damage currently resolve at start of main2 (the next priority loop). Adding a window after damage would let triggers resolve immediately in the combat step.

---

## How to add a new card (the easy path)

1. Create `src/cards/data/<id>.js` exporting a default object matching the
   schema above. Reuse existing effect IDs and filter types.
2. Import + register in `src/cards/data/index.js`.
3. Hard-reload the browser. The card appears in the Decks editor library grid
   automatically.

If the card needs a new effect or filter, add it to the relevant registry
first and consider whether `BasicAI._pickTarget` / `isUsefulTarget` needs an
effect-id-specific case for sensible AI behavior.

---

## Memory files (auto-loaded — separate from this doc)

User-facing project facts live in memory under
`~/.claude/projects/-mnt-c-Users-jeffr-OneDrive-Documents-my-games-dtcg/memory/`:
- `project_dtcg.md` — high-level project description
- `dtcg_card_conventions.md` — rules conventions (rounding, X notation,
  lifelink-as-keyword, errata in source PDF)
- `feedback_collaboration.md` — collaboration style (plans before code,
  vertical slices, flag gaps proactively)

This `CLAUDE.md` covers the **code-side** picture. The two together cover
~90% of context needed to be productive immediately.
