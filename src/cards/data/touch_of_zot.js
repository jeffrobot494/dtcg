export default {
  id: 'touch_of_zot',
  name: 'Touch of Zot',
  type: 'instant',
  color: 'B',
  cost: { B: 1 },
  effects: [
    {
      id: 'grant_keywords',
      keywords: ['deathtouch', 'lifelink'],
      target: { type: 'creature_you_control' },
    },
  ],
};
