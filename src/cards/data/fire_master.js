export default {
  id: 'fire_master',
  name: 'Fire Master',
  type: 'creature',
  color: 'R',
  manaValue: 3,
  cost: { generic: 1, R: 2 },
  power: 0,
  toughness: 2,
  abilities: [
    {
      kind: 'activated',
      cost: { tap: true },
      effects: [
        { id: 'deal_damage', amount: 1, target: { type: 'any' } },
      ],
    },
  ],
};
