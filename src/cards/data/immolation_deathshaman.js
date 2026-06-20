export default {
  id: 'immolation_deathshaman',
  name: 'Immolation Deathshaman',
  type: 'creature',
  color: 'R',
  manaValue: 2,
  cost: { mana: 2 },
  power: 0,
  toughness: 1,
  triggers: [
    {
      event: 'creature_dies',
      condition: { type: 'you_control' },
      effects: [{ id: 'deal_damage', amount: 1, target: { type: 'any' } }],
    },
  ],
};
