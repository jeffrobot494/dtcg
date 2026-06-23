export default {
  id: 'press_into_service',
  name: 'Press Into Service',
  type: 'sorcery',
  color: 'B',
  cost: { B: 2, x: 'mana' },
  effects: [
    {
      id: 'exile_target',
      target: { type: 'creature_in_graveyard', count: 'x' },
    },
    {
      id: 'create_tokens',
      count: 'x',
      template: { name: 'Ghoul', type: 'creature', power: 2, toughness: 1, color: 'B' },
    },
  ],
};
