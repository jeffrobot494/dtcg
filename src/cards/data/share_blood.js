export default {
  id: 'share_blood',
  name: 'Share Blood',
  type: 'sorcery',
  color: 'B',
  cost: { generic: 1, B: 1, x: 'life' },
  effects: [
    // "Target creature heals 1/2 X life" — ceil(X/2) damage removed.
    // Restricted to creatures you control so the heal isn't given to enemies.
    { id: 'remove_damage', amount: 'half_x', target: { type: 'creature_you_control' } },
  ],
};
