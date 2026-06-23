export default {
  id: 'conflagration',
  name: 'Conflagration',
  type: 'sorcery',
  color: 'R',
  manaValue: 3,
  cost: { generic: 1, R: 2 },
  effects: [
    { id: 'destroy_target', target: { type: 'land' } },
  ],
};
