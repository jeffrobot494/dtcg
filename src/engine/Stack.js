// The Stack holds spells/abilities that have been cast/activated but not yet
// resolved. Each item carries the source card, its controller, and the targets
// chosen at cast time. The card itself lives in `match.stackZone` while on
// the stack so card.zone stays meaningful.
export class Stack {
  constructor() {
    this.items = [];  // [{ card, controller, targets }]
  }

  push(item) { this.items.push(item); }
  pop() { return this.items.pop(); }
  peek() { return this.items[this.items.length - 1]; }
  get isEmpty() { return this.items.length === 0; }
  get size() { return this.items.length; }
}
