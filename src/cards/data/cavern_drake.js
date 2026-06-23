export default {
  id: 'cavern_drake',
  name: 'Cavern Drake',
  type: 'creature',
  color: 'R',
  manaValue: 3,
  cost: { generic: 1, R: 2 },
  power: 1,
  toughness: 1,
  keywords: ['flying'],
  triggers: [
    {
      event: 'creature_attacks',
      condition: { type: 'self' },
      effects: [
        { id: 'grant_keywords', keywords: ['flying'], target: { type: 'creature_you_control' } },
      ],
    },
  ],
};
