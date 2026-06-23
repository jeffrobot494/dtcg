export default {
  id: 'simulacrum',
  name: 'Simulacrum',
  type: 'creature',
  color: 'B',
  cost: { generic: 2, B: 2, x: 'life' },
  power: 1,
  toughness: 1,
  conditionalKeywords: [
    { keyword: 'flying', when: { x: { gte: 5 } } },
  ],
  triggers: [
    {
      event: 'creature_etb',
      condition: { type: 'self' },
      effects: [
        { id: 'put_counter_on_self', counter: '+1/+0', amount: 'x' },
      ],
    },
  ],
};
