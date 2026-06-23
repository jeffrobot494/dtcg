export default {
  id: 'erupt',
  name: 'Erupt',
  type: 'sorcery',
  color: 'R',
  manaValue: 4,
  cost: { generic: 2, R: 2 },
  effects: [
    { id: 'damage_to_all', amount: 2, filter: { type: 'creature_without_flying' } },
  ],
};
