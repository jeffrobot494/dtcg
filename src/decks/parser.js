import { getCardDef } from '../cards/data/index.js';

// Parses MTG-Arena-style deck text into { id, name, cards: [[cardId, count]] }.
// Format:
//   # comments and blank lines ignored
//   # Name: Optional Display Name      (single optional directive)
//   <count> <card_id>                  one card line at a time
export function parseDeck(text, id) {
  const lines = text.split(/\r?\n/);
  let name = id;
  const cards = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const m = line.match(/^#\s*name\s*:\s*(.+)$/i);
      if (m) name = m[1].trim();
      continue;
    }
    const m = line.match(/^(\d+)\s+(\S+)$/);
    if (!m) {
      console.warn(`Deck "${id}": unparseable line: "${line}"`);
      continue;
    }
    const count = parseInt(m[1], 10);
    const cardId = m[2];
    try {
      getCardDef(cardId);
    } catch {
      console.warn(`Deck "${id}": unknown card id "${cardId}" — skipping`);
      continue;
    }
    cards.push([cardId, count]);
  }
  return { id, name, cards };
}

// Fetches and parses a deck file. Deck id is derived from the filename.
export async function loadDeck(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load deck ${path}: ${res.status}`);
  const text = await res.text();
  const filename = path.split('/').pop() ?? path;
  const id = filename.replace(/\.txt$/i, '');
  return parseDeck(text, id);
}
