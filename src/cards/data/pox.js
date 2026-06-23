export default {
  id: 'pox',
  name: 'Pox',
  type: 'enchantment',
  color: 'B',
  cost: { B: 2 },
  keywords: ['lifelink'],
  triggers: [
    {
      event: 'phase_begins',
      condition: { type: 'your_phase', phase: 'end' },
      effects: [
        { id: 'deal_damage', amount: 1, target: { type: 'non_black_creature' } },
      ],
    },
  ],
};
