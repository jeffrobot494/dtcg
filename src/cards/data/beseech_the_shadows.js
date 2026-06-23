export default {
  id: 'beseech_the_shadows',
  name: 'Beseech the Shadows',
  type: 'sorcery',
  color: 'B',
  manaValue: 2,
  cost: { B: 2 },
  effects: [
    { id: 'draw_cards', amount: 2 },
    { id: 'lose_life', amount: 2, who: 'controller' },
  ],
};
