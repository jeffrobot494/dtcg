export default {
  id: 'rockslide',
  name: 'Rockslide',
  type: 'instant',
  color: 'R',
  manaValue: 2,
  cost: { generic: 1, R: 1 },
  effects: [
    { id: 'deal_damage', amount: 2, target: { type: 'creature_without_flying' } },
  ],
};
