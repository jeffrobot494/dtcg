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
  partial: true,
  // TODO: "Whenever a creature is destroyed by Aunaratha, you gain 1 life."
  // Needs damage-source attribution on the creature-dies event.
};
