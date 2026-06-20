export default {
  id: 'destroy_artifact',
  name: 'Destroy Artifact',
  type: 'instant',
  color: 'R',
  manaValue: 2,
  cost: { mana: 2 },
  effects: [
    { id: 'destroy_target', target: { type: 'artifact' } },
  ],
};
