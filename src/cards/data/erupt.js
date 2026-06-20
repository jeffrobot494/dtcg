export default {
  id: 'erupt',
  name: 'Erupt',
  type: 'sorcery',
  color: 'R',
  manaValue: 5,
  cost: { mana: 5 },
  effects: [
    { id: 'damage_to_all', amount: 2, filter: { type: 'creature_without_flying' } },
  ],
};
