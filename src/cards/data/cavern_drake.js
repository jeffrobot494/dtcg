export default {
  id: 'cavern_drake',
  name: 'Cavern Drake',
  type: 'creature',
  color: 'R',
  manaValue: 4,
  cost: { generic: 3, R: 1 },
  power: 1,
  toughness: 1,
  keywords: ['flying'],
  partial: true,
  // TODO (triggers slice): When Cavern Drake attacks, target creature you control
  // gains flying until end of turn.
};
