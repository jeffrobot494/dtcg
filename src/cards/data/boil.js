export default {
  id: 'boil',
  name: 'Boil',
  type: 'instant',
  color: 'R',
  manaValue: 1,
  cost: { mana: 1 },
  effects: [
    { id: 'deal_damage', amount: 1, target: { type: 'any' } },
  ],
};
