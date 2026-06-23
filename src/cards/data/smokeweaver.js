export default {
  id: 'smokeweaver',
  name: 'Smokeweaver',
  type: 'creature',
  color: 'R',
  cost: { generic: 1, R: 2 },
  power: 0,
  toughness: 1,
  replacements: [
    {
      event: 'damage_dealt',
      condition: { type: 'damage_to_you_control' },
      modify: { type: 'reduce_damage', amount: 1 },
    },
  ],
};
