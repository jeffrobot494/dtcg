export default {
  id: 'fire_servant',
  name: 'Fire Servant',
  type: 'creature',
  color: 'R',
  manaValue: 2,
  cost: { mana: 2 },
  power: 0,
  toughness: 1,
  triggers: [
    {
      event: 'creature_dies',
      condition: { type: 'self' },
      effects: [{ id: 'deal_damage', amount: 1, target: { type: 'any' } }],
    },
  ],
};
