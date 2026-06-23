import { describeCard } from './cardText.js';

// Owns one tooltip DOM element (lives in document.body so it survives view
// re-renders). Caller decides when to show/hide via scheduleShow() / hide().

const DELAY_MS = 500;

export class CardTooltip {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'card-tooltip hidden';
    document.body.appendChild(this.el);
    this.timer = null;
  }

  scheduleShow(anchorEl, cardOrDef) {
    this.hide();
    this.timer = setTimeout(() => {
      this.el.innerHTML = describeCard(cardOrDef);
      this.el.classList.remove('hidden');
      this._positionNear(anchorEl);
    }, DELAY_MS);
  }

  hide() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.el.classList.add('hidden');
  }

  // Place below the anchor; flip above and clamp to viewport if needed.
  _positionNear(anchorEl) {
    const card = anchorEl.getBoundingClientRect();
    this.el.style.top = `${card.bottom + 6}px`;
    this.el.style.left = `${card.left}px`;
    const tt = this.el.getBoundingClientRect();
    if (tt.bottom > window.innerHeight - 8) {
      this.el.style.top = `${Math.max(8, card.top - tt.height - 6)}px`;
    }
    if (tt.right > window.innerWidth - 8) {
      this.el.style.left = `${window.innerWidth - tt.width - 8}px`;
    }
  }
}
