export default {
  id: 'rockslide',
  name: 'Rockslide',
  type: 'instant',
  color: 'R',
  manaValue: 2,
  cost: { mana: 2 },
  effects: [
    { id: 'deal_damage', amount: 2, target: { type: 'creature_without_flying' } },
  ],
};
