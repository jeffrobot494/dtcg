export default {
  id: 'walk_on_coals',
  name: 'Walk on Coals',
  type: 'enchantment',
  color: 'R',
  cost: { generic: 1, R: 1 },
  triggers: [
    {
      event: 'phase_begins',
      condition: { type: 'your_phase', phase: 'main1' },
      effects: [
        { id: 'add_mana', mana: { R: 1 } },
        { id: 'lose_life', amount: 1, who: 'controller' },
      ],
    },
  ],
};
