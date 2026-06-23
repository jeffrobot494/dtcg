export default {
  id: 'aunaratha',
  name: 'Aunaratha',
  type: 'artifact',
  subtype: 'equipment',
  color: 'B',
  cost: { generic: 1, B: 1 },
  staticBuff: { power: 1, toughness: 1 },
  abilities: [
    {
      kind: 'activated',
      cost: { mana: { generic: 2 } },
      speed: 'sorcery',
      effects: [{ id: 'attach', target: { type: 'creature_you_control' } }],
    },
  ],
  triggers: [
    {
      event: 'creature_dies',
      condition: { type: 'killed_by_my_attached_creature' },
      effects: [{ id: 'gain_life', amount: 1, who: 'controller' }],
    },
  ],
};
