export default {
  id: 'erupt',
  name: 'Erupt',
  type: 'sorcery',
  color: 'R',
  manaValue: 5,
  cost: { generic: 4, R: 1 },
  effects: [
    { id: 'damage_to_all', amount: 2, filter: { type: 'creature_without_flying' } },
  ],
};
