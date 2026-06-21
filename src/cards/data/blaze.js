export default {
  id: 'blaze',
  name: 'Blaze',
  type: 'sorcery',
  color: 'R',
  cost: { generic: 1, x: 'mana' },
  effects: [
    { id: 'deal_damage', amount: 'x', target: { type: 'any' } },
  ],
};
