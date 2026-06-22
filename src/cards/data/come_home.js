export default {
  id: 'come_home',
  name: 'Come Home',
  type: 'sorcery',
  color: 'B',
  cost: { generic: 2, B: 1, x: 'life' },
  effects: [
    {
      id: 'return_to_hand',
      target: { type: 'creature_in_your_graveyard', count: 'x' },
    },
  ],
};
