export default {
  id: 'honor_with_immortality',
  name: 'Honor with Immortality',
  type: 'sorcery',
  color: 'B',
  cost: { generic: 1, B: 1 },
  effects: [
    {
      id: 'exile_and_golem',
      target: { type: 'creature_in_graveyard' },
    },
  ],
};
