export default {
  id: 'staff_of_pain',
  name: 'Staff of Pain',
  type: 'artifact',
  subtype: 'equipment',
  color: 'R',
  cost: { generic: 2, R: 1 },
  staticBuff: { power: 1, toughness: 0 },
  abilities: [
    {
      kind: 'activated',
      cost: { mana: { generic: 1 } },
      speed: 'sorcery',
      effects: [{ id: 'attach', target: { type: 'creature_you_control' } }],
    },
  ],
  partial: true,
  // TODO: Equipped creature gains "{T}: deal 1 damage to any target."
  // Needs a "granted activated abilities" system (analogous to granted keywords).
};
