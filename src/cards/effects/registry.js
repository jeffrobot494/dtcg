// Effect registry. Effect modules call defineEffect(id, fn) at import time.
// fn signature: (match, ctx, params) -> void | Promise<void>
//   ctx = { source: Card, controller: MatchPlayer, target: Card | MatchPlayer | null }
//   params = the per-effect entry from card.def.effects (carries amount, etc.)

const effects = new Map();

export function defineEffect(id, fn) {
  if (effects.has(id)) {
    console.warn(`Effect "${id}" redefined.`);
  }
  effects.set(id, fn);
}

export function getEffect(id) {
  const fn = effects.get(id);
  if (!fn) throw new Error(`Unknown effect: ${id}`);
  return fn;
}
