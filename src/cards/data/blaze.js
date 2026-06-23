export default {
  id: 'blaze',
  name: 'Blaze',
  type: 'sorcery',
  color: 'R',
  cost: { R: 1, x: 'mana' },
  effects: [
    { id: 'deal_damage', amount: 'x', target: { type: 'any' } },
  ],
};
