// Mana cost & pool utilities.
//
// Cost shape: { generic?: number, x?: 'mana', R?: number, B?: number }
//   { generic: 2, R: 1 }            -> {2}{R}
//   { R: 1 }                        -> {R}
//   { generic: 1, x: 'mana' }       -> {X}{1}    (X is always generic)
//
// Pool shape: { R: number, B: number }  (extend COLORS to add more)

const COLORS = ['R', 'B'];

export function emptyPool() {
  const p = {};
  for (const c of COLORS) p[c] = 0;
  return p;
}

export function totalMana(pool) {
  return COLORS.reduce((s, c) => s + (pool[c] ?? 0), 0);
}

// True if `pool` can pay `cost`'s base (does not include X).
export function canPayCost(pool, cost) {
  if (!cost) return true;
  for (const c of COLORS) {
    if ((cost[c] ?? 0) > (pool[c] ?? 0)) return false;
  }
  const coloredNeeded = COLORS.reduce((s, c) => s + (cost[c] ?? 0), 0);
  const generic = cost.generic ?? 0;
  return totalMana(pool) - coloredNeeded >= generic;
}

// Mutates `pool` to pay `cost`. Generic drains in COLORS order — players don't
// pick which color to spend. Caller must have validated canPayCost first.
export function payCost(pool, cost) {
  if (!cost) return;
  for (const c of COLORS) {
    pool[c] -= (cost[c] ?? 0);
  }
  let generic = cost.generic ?? 0;
  for (const c of COLORS) {
    const use = Math.min(pool[c], generic);
    pool[c] -= use;
    generic -= use;
    if (generic === 0) break;
  }
}

// Largest X the player can afford on top of the base cost.
// Returns -1 if the base cost itself can't be paid.
export function maxXFromPool(pool, cost) {
  if (!cost) return 0;
  for (const c of COLORS) {
    if ((cost[c] ?? 0) > (pool[c] ?? 0)) return -1;
  }
  const coloredNeeded = COLORS.reduce((s, c) => s + (cost[c] ?? 0), 0);
  const baseGeneric = cost.generic ?? 0;
  const after = totalMana(pool) - coloredNeeded - baseGeneric;
  return after < 0 ? -1 : after;
}

// Total mana value of a cost (sum of generic + all colored). Ignores X.
export function manaValue(cost) {
  if (!cost) return 0;
  return (cost.generic ?? 0) + COLORS.reduce((s, c) => s + (cost[c] ?? 0), 0);
}

// Formats cost for display: "{X}{2}{R}".
export function formatCost(cost) {
  if (!cost) return '';
  const parts = [];
  if (cost.x === 'mana') parts.push('{X}');
  if ((cost.generic ?? 0) > 0) parts.push(`{${cost.generic}}`);
  for (const c of COLORS) {
    for (let i = 0; i < (cost[c] ?? 0); i++) parts.push(`{${c}}`);
  }
  return parts.join('');
}

// Formats a pool for display: "2R 1B" or "—".
export function formatPool(pool) {
  const parts = [];
  for (const c of COLORS) {
    if ((pool[c] ?? 0) > 0) parts.push(`${pool[c]}${c}`);
  }
  return parts.length ? parts.join(' ') : '—';
}
