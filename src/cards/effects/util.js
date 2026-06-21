// Resolves an effect parameter that may reference the cast-time X value.
// Conventions:
//   'x'      -> ctx.x
//   'half_x' -> ceil(ctx.x / 2)   (rounding-up house rule)
//   number   -> as-is
export function resolveAmount(value, ctx) {
  if (value === 'x')      return ctx.x ?? 0;
  if (value === 'half_x') return Math.ceil((ctx.x ?? 0) / 2);
  return value ?? 0;
}
