export default {
  id: 'fire_drake',
  name: 'Fire Drake',
  type: 'creature',
  color: 'R',
  manaValue: 5,
  cost: { generic: 4, R: 1 },
  power: 1,
  toughness: 2,
  keywords: ['flying'],
  triggers: [
    {
      event: 'creature_attacks',
      condition: { type: 'self' },
      effects: [
        { id: 'deal_damage', amount: 1, target: { type: 'any' } },
        { id: 'grant_keywords', keywords: ['flying'], target: { type: 'creature_you_control' } },
      ],
    },
  ],
};
