# LLM Agent Plan

Here's the plan. It's grounded in your actual `Match.js` priority model and the `Agent` seam, and it folds in the model/API specifics I just pulled.

## Design decision that shapes everything: turn-level planning, not per-action

Your `priorityLoop` (`Match.js:107`) is **micro-action granular** — it asks the agent for one thing at a time (`tap_for_mana` one land, then `cast` one card, then pass). If I called the LLM once per `choosePriorityAction`, a single turn would be 5–10 API round-trips, and the LLM would be doing mana-tapping arithmetic — its weakest skill, and slow/expensive.

So `LLMAgent.choosePriorityAction` will:
1. On first priority of the turn, call the LLM **once** to get a high-level plan: an ordered list of cards to play (lands + spells, with intended targets).
2. Cache that plan, then **dispense micro-actions** from it using your existing heuristic helpers (`pickLandToTap`, `canPayCost`) to handle the mechanical tapping.
3. Re-plan only if the board state diverges from what the plan assumed (e.g., a trigger killed something).

This keeps it to **~1 LLM call per turn**, and the LLM never touches mana math.

## Files

| File | Change |
|---|---|
| `src/agents/LLMAgent.js` | **New.** `extends Agent`. Implements the 5 methods; wraps a `BasicAI` instance for fallback + delegated decisions. |
| `src/agents/serializeState.js` | **New.** Pure function `Match → JSON` for the prompt. |
| `src/agents/llmClient.js` | **New.** Thin wrapper around the API call (model, structured output, timeout, error handling). |
| *(backend proxy — see decision below)* | New, small. |
| Wherever agents are instantiated (match setup) | Allow choosing `LLMAgent` for the AI seat. |

## The 5 methods (first slice)

```
choosePriorityAction → LLM (turn plan, dispensed as micro-actions)
chooseTarget         → BasicAI._pickTarget   (keep — it's already sharp)
chooseXValue         → BasicAI               (it's arithmetic)
declareAttackers     → BasicAI._pickAttackers (combat math + persistent damage)
declareBlockers      → BasicAI._pickBlockers  (lethal detection)
```

Only `choosePriorityAction` goes to the LLM in slice 1. This is where the LLM adds the most (gameplan, sequencing, generalizing to new cards like `fire_drake`) and risks the least (no combat math). Everything else delegates to your existing, working heuristics.

## The LLM call (using the API specifics)

- **JS project → `@anthropic-ai/sdk`** (the official SDK), not raw fetch.
- **Model:** I'd default to **`claude-opus-4-8`**, but flag **`claude-haiku-4-5`** as a serious option here — game AI is latency- and cost-sensitive, decisions fire constantly, and Haiku is far cheaper/faster. I'd start on Opus to validate that the *playstyle* is good, then test whether Haiku holds up. Your call; I'll make it a one-line config swap.
- **Structured output (this is the legality unlock):** force the response into a schema via `output_config.format` — a `{ plan: [{ cardId, targetId? }], reasoning }` shape. No free-text parsing.
- **Validate every step** against `canPayCost` / `isValidTarget` / `canBlock` (already imported in `BasicAI.js:2-4`). Any card not in hand, unaffordable, or untargetable → drop that step.
- **Fallback:** on API error, timeout (~3s), or an empty/all-invalid plan → call `BasicAI._mainPhaseAction`. **You never play worse than today.**
- `effort: "low"` is appropriate here (cheap, fast, and the task is bounded) — I'll start there and bump if play quality needs it.

## State serializer

Pulls from objects you already have, no engine changes: both players' `life`, `manaPool`, untapped-land mana available (reuse `potentialPool`), full own hand (`name`, `cost`, `def.type`, `def.effects`, keywords), opponent hand as **count only**, both battlefields (`power`/`toughness`/`damage`/keywords/`tapped`/`summoningSick`), graveyards, stack, phase. Each card gets a stable `id` so the LLM can reference it back unambiguously.

## ⚠️ One real decision: the API key

Calling the Anthropic API directly from browser JS **exposes your API key** to anyone who opens devtools. Two paths:

- **A. Local-dev / single-player only (fastest):** key in a local env, accept it's not shippable. Fine for prototyping the AI now.
- **B. Tiny backend proxy (shippable):** a ~30-line Node endpoint that holds the key and forwards game-state → LLM-decision. Needed before this ever goes public.

I'd build **A first** to prove the AI is worth it, structured so swapping in **B** later is just changing the URL in `llmClient.js`.

## Milestones

1. **Serializer + `llmClient`** (local key) — verify a clean state blob and a valid structured response.
2. **`LLMAgent`** — LLM for `choosePriorityAction`, everything else delegated to `BasicAI`, with full fallback.
3. **Playtest** Opus vs. `BasicAI` and Opus vs. you — judge whether the playstyle is actually smarter.
4. *(later)* Decide Haiku vs Opus; optionally extend the LLM to `chooseTarget`; add the backend proxy for B.

---

Two things I'd like your call on before I write code: **(1)** local key (path A) or backend proxy (path B) for this first pass, and **(2)** start on Opus 4.8 or go straight to Haiku 4.5 for cost/latency? My defaults are **A** and **Opus 4.8**, but the proxy/Haiku choices are genuinely yours.
