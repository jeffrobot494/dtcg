export default {
  id: 'honored_ghoul',
  name: 'Honored Ghoul',
  type: 'creature',
  color: 'B',
  cost: { generic: 1, B: 1 },
  power: 1,
  toughness: 1,
  abilities: [
    {
      kind: 'activated',
      cost: { mana: { B: 1 }, life: 1 },
      effects: [{ id: 'add_regen_shield' }],
    },
  ],
};
