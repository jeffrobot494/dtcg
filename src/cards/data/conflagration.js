export default {
  id: 'conflagration',
  name: 'Conflagration',
  type: 'sorcery',
  color: 'R',
  manaValue: 3,
  cost: { mana: 3 },
  effects: [
    { id: 'destroy_target', target: { type: 'land' } },
  ],
};
