export default {
  id: 'incinerate',
  name: 'Incinerate',
  type: 'instant',
  color: 'R',
  cost: { generic: 1, R: 2 },
  effects: [
    { id: 'incinerate', amount: 2, target: { type: 'any' } },
  ],
};
