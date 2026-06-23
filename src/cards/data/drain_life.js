export default {
  id: 'drain_life',
  name: 'Drain Life',
  type: 'sorcery',
  color: 'B',
  cost: { B: 2, x: 'mana' },
  // Lifelink keyword on the spell handles "gain life equal to damage dealt".
  keywords: ['lifelink'],
  effects: [
    { id: 'deal_damage', amount: 'x', target: { type: 'any' } },
  ],
};
