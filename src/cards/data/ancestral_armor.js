export default {
  id: 'ancestral_armor',
  name: 'Ancestral Armor',
  type: 'artifact',
  subtype: 'equipment',
  color: 'B',
  cost: { generic: 1, B: 1 },
  staticBuff: { power: 0, toughness: 2 },
  abilities: [
    {
      kind: 'activated',
      cost: { mana: { generic: 2 } },
      speed: 'sorcery',
      effects: [{ id: 'attach', target: { type: 'creature_you_control' } }],
    },
  ],
};
