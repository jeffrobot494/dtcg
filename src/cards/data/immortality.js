export default {
  id: 'immortality',
  name: 'Immortality',
  type: 'sorcery',
  color: 'B',
  cost: { generic: 2, B: 2 },
  effects: [
    {
      id: 'return_to_battlefield',
      target: { type: 'creature_in_your_graveyard' },
      counter: '-1/+1',
      amount: 1,
    },
  ],
};
