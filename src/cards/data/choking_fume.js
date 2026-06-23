export default {
  id: 'choking_fume',
  name: 'Choking Fume',
  type: 'sorcery',
  color: 'B',
  manaValue: 3,
  cost: { generic: 1, B: 2 },
  keywords: ['lifelink'],
  effects: [
    { id: 'damage_to_all', amount: 1, filter: { type: 'non_black_creature' } },
  ],
};
