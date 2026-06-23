export default {
  id: 'giant_vampire_bat',
  name: 'Giant Vampire Bat',
  type: 'creature',
  color: 'B',
  cost: { generic: 2, B: 1 },
  power: 2,
  toughness: 1,
  keywords: ['flying', 'lifelink'],
  triggers: [
    {
      event: 'phase_begins',
      condition: { type: 'your_phase', phase: 'upkeep' },
      effects: [{ id: 'lose_life', amount: 1, who: 'controller' }],
    },
  ],
};
