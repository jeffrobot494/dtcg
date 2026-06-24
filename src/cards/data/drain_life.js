export default {
  id: 'drain_life',
  name: 'Drain Life',
  type: 'sorcery',
  color: 'B',
  cost: { B: 2, x: 'mana' },
  effects: [
    { id: 'drain_life', amount: 'x', target: { type: 'any' } },
  ],
};
