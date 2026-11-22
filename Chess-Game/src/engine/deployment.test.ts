import { describe, expect, it } from 'vitest';
import {
  buildPrepFen,
  DEFAULT_ARRANGEMENT,
  isValidArrangement,
  normalizeArrangement,
  type BackRankArrangement,
} from './deployment';
import { STARTING_FEN } from './core/StandardEngine';

const SWAPPED: BackRankArrangement = [
  'knight',
  'rook',
  'bishop',
  'bishop',
  'rook',
  'knight',
];

describe('deployment arrangement validation', () => {
  it('accepts the default arrangement', () => {
    expect(isValidArrangement(DEFAULT_ARRANGEMENT)).toBe(true);
  });

  it('accepts a rearrangement that keeps the piece multiset', () => {
    expect(isValidArrangement(SWAPPED)).toBe(true);
  });

  it('rejects a wrong multiset', () => {
    const bad: BackRankArrangement = [
      'rook',
      'rook',
      'rook',
      'knight',
      'knight',
      'bishop',
    ];
    expect(isValidArrangement(bad)).toBe(false);
  });

  it('rejects the wrong length or null', () => {
    expect(isValidArrangement(DEFAULT_ARRANGEMENT.slice(0, 5))).toBe(false);
    expect(isValidArrangement(null)).toBe(false);
    expect(isValidArrangement(undefined)).toBe(false);
  });
});

describe('deploying the standard position', () => {
  it('reproduces the standard FEN when neither side plays Redeployment', () => {
    expect(buildPrepFen(null, null)).toBe(STARTING_FEN);
  });

  it('reproduces the standard FEN when arrangements equal the default', () => {
    expect(buildPrepFen(DEFAULT_ARRANGEMENT, DEFAULT_ARRANGEMENT)).toBe(STARTING_FEN);
  });
});

/** The white back rank from a FEN (the last field carries " w - - 0 1"). */
function whiteRankOf(fen: string): string {
  return fen.split('/').pop()!.trim().split(' ')[0];
}

/** The black back rank from a FEN (the first field). */
function blackRankOf(fen: string): string {
  return fen.split('/')[0];
}

describe('deploying rearranged positions', () => {
  it('swaps the back rank while keeping the queen and king in place', () => {
    const fen = buildPrepFen(SWAPPED, null);
    // White back rank: a=knight, b=rook, c=bishop, d=queen, e=king,
    // f=bishop, g=rook, h=knight.
    expect(whiteRankOf(fen)).toBe('NRBQKBRN');
    // Queen and king stay on their files (d and e).
    expect(whiteRankOf(fen).charAt(3)).toBe('Q');
    expect(whiteRankOf(fen).charAt(4)).toBe('K');
  });

  it('produces the exact expected back ranks', () => {
    const fen = buildPrepFen(SWAPPED, null);
    // White back rank.
    expect(whiteRankOf(fen)).toBe('NRBQKBRN');
    // Black keeps the standard rank.
    expect(blackRankOf(fen)).toBe('rnbqkbnr');
  });

  it('derives castling rights from the rearranged rooks', () => {
    // Default: rooks on a1 and h1 -> both K and Q rights.
    expect(buildPrepFen(null, null)).toContain('KQkq');

    // SWAPPED puts the rooks on b and g, so neither edge-file right
    // exists: only the black rights survive.
    expect(buildPrepFen(SWAPPED, null)).toContain('kq');
    expect(buildPrepFen(SWAPPED, null)).not.toContain('KQkq');

    // Rooks back on the edges in the wrong order still grants both rights:
    // [rook, ... , rook] is exactly the default.
    expect(buildPrepFen(DEFAULT_ARRANGEMENT, null)).toContain('KQ');
  });

  it('applies both sides at once', () => {
    const fen = buildPrepFen(SWAPPED, SWAPPED);
    expect(whiteRankOf(fen)).toBe('NRBQKBRN');
    expect(blackRankOf(fen)).toBe('nrbqkbrn');
  });

  it('falls back to the standard rank for an invalid arrangement', () => {
    const fen = buildPrepFen(['rook' as never, 'rook', 'rook', 'rook', 'rook', 'rook'], null);
    expect(fen).toBe(STARTING_FEN);
  });
});

describe('normalizing RTDB arrays', () => {
  it('normalises a plain array', () => {
    expect(normalizeArrangement(SWAPPED)).toEqual(SWAPPED);
  });

  it('normalises an object with numeric keys, as RTDB may return', () => {
    const obj = { 0: 'rook', 1: 'knight', 2: 'bishop', 3: 'bishop', 4: 'knight', 5: 'rook' };
    expect(normalizeArrangement(obj)).toEqual(DEFAULT_ARRANGEMENT);
  });

  it('rejects malformed values', () => {
    expect(normalizeArrangement('rook,knight')).toBeNull();
    expect(normalizeArrangement([1, 2, 3, 4, 5, 6])).toBeNull();
    expect(normalizeArrangement(null)).toBeNull();
  });
});
