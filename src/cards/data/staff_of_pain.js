export default {
  id: 'staff_of_pain',
  name: 'Staff of Pain',
  type: 'artifact',
  subtype: 'equipment',
  color: 'R',
  cost: { generic: 1, R: 2 },
  staticBuff: {
    power: 1,
    toughness: 0,
    grantedAbilities: [
      {
        kind: 'activated',
        cost: { tap: true },
        effects: [{ id: 'deal_damage', amount: 1, target: { type: 'any' } }],
      },
    ],
  },
  abilities: [
    {
      kind: 'activated',
      cost: { mana: { generic: 1 } },
      speed: 'sorcery',
      effects: [{ id: 'attach', target: { type: 'creature_you_control' } }],
    },
  ],
};
