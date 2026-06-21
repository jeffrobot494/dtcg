export default {
  id: 'beseech_the_shadows',
  name: 'Beseech the Shadows',
  type: 'sorcery',
  color: 'B',
  manaValue: 2,
  cost: { generic: 1, B: 1 },
  effects: [
    { id: 'draw_cards', amount: 2 },
    { id: 'lose_life', amount: 2, who: 'controller' },
  ],
};
