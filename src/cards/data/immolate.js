export default {
  id: 'immolate',
  name: 'Immolate',
  type: 'instant',
  color: 'R',
  cost: { R: 1 },
  effects: [
    { id: 'modify_stats', power: 1, toughness: -1, target: { type: 'creature' } },
  ],
};
