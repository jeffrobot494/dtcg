export default {
  id: 'dishonored_ghoul',
  name: 'Dishonored Ghoul',
  type: 'creature',
  color: 'B',
  cost: { B: 2 },
  power: 1,
  toughness: 1,
  triggers: [
    {
      event: 'creature_dies',
      condition: { type: 'self' },
      optional: true,
      cost: { life: 1 },
      effects: [{ id: 'return_self_to_hand' }],
    },
  ],
};
