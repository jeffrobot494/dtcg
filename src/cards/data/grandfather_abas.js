export default {
  id: 'grandfather_abas',
  name: 'Grandfather Abas',
  type: 'creature',
  color: 'B',
  cost: { generic: 1, B: 3 },
  power: 3,
  toughness: 1,
  abilities: [
    {
      kind: 'activated',
      cost: { mana: { B: 1 } },
      effects: [{ id: 'add_regen_shield' }],
    },
  ],
};
