export default {
  id: 'mighty_serpent_of_the_vale',
  name: 'Mighty Serpent of the Vale',
  type: 'creature',
  color: 'B',
  manaValue: 5,
  cost: { generic: 3, B: 2 },
  power: 2,
  toughness: 4,
  keywords: ['deathtouch'],
  triggers: [
    {
      event: 'creature_dies',
      condition: { type: 'self' },
      effects: [{ id: 'lose_life', amount: 4, who: 'controller' }],
    },
  ],
};
