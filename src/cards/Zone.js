export class Zone {
  constructor(name, owner, { visibleTo = 'all', layout = 'stack' } = {}) {
    this.name = name;
    this.owner = owner;
    this.visibleTo = visibleTo;
    this.layout = layout;
    this.cards = [];
  }

  add(card) {
    card.zone = this;
    this.cards.push(card);
  }

  remove(card) {
    const i = this.cards.indexOf(card);
    if (i >= 0) this.cards.splice(i, 1);
  }

  get size() { return this.cards.length; }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  drawTop() { return this.cards.pop(); }
}
