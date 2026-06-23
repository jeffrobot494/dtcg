export default {
  id: 'terror',
  name: 'Terror',
  type: 'sorcery',
  color: 'B',
  cost: { generic: 1, B: 2 },
  effects: [
    {
      id: 'grant_keywords_to_all',
      keywords: ['fear'],
      filter: { type: 'creature_you_control' },
    },
  ],
};
