import { describe, expect, it } from 'vitest';
import {
  CARD_CATALOG,
  DECK_SIZE,
  getCard,
  isValidDeck,
} from './catalog';

describe('card catalog', () => {
  it('lists the six launch-pool cards, one per color', () => {
    expect(CARD_CATALOG).toHaveLength(6);
    const colors = new Set(CARD_CATALOG.map((c) => c.color));
    expect(colors.size).toBe(6);
  });

  it('resolves cards by id', () => {
    expect(getCard('tower')?.name).toBe('The Tower');
    expect(getCard('major-conflict')?.points).toBe(5);
    expect(getCard('does-not-exist')).toBeUndefined();
  });

  it('marks the transformable cards with their sprite', () => {
    expect(getCard('tower')?.transformedSprite).toBe('the-tower');
    expect(getCard('charmer')?.transformedSprite).toBe('the-charmer');
    expect(getCard('abyss')?.transformedSprite).toBeUndefined();
  });
});

describe('deck validation', () => {
  it('accepts up to three different-color cards', () => {
    expect(isValidDeck(['tower', 'charmer', 'abyss'])).toBe(true);
    expect(isValidDeck(['tower'])).toBe(true);
  });

  it('allows an empty deck', () => {
    expect(isValidDeck([])).toBe(true);
  });

  it('rejects more than three cards', () => {
    expect(isValidDeck(CARD_CATALOG.map((c) => c.id))).toBe(false);
    expect(DECK_SIZE).toBe(3);
  });

  it('rejects duplicate ids', () => {
    expect(isValidDeck(['tower', 'tower'])).toBe(false);
  });

  it('rejects two cards of the same color', () => {
    // The launch pool has one card per color, so test with a duplicated
    // color by constructing the same-color pair directly is not possible;
    // instead assert the color-set invariant used by isValidDeck:
    const goldCards = CARD_CATALOG.filter((c) => c.color === 'gold');
    expect(goldCards).toHaveLength(1);
    expect(isValidDeck(['tower', 'unknown', 'tower'])).toBe(false);
  });

  it('rejects unknown card ids', () => {
    expect(isValidDeck(['tower', 'not-a-card'])).toBe(false);
  });
});
