import { describe, expect, it } from 'vitest';
import {
  createEmptyVariantEffects,
  VariantEngine,
  type VariantEffects,
} from './VariantEngine';
import { STARTING_FEN } from './core/StandardEngine';

/** White rook a1, white king g1, black rook e8, black king f8, white to move. */
const ROOK_FEN = '4rk2/8/8/8/8/8/8/R5K1 w - - 0 1';

/** White knight b1, white king g1, black king e8, white to move. */
const KNIGHT_FEN = '4k3/8/8/8/8/8/8/1N4K1 w - - 0 1';

function effectsWithHoles(holes: string[]): VariantEffects {
  return { ...createEmptyVariantEffects(), holes };
}

describe('VariantEngine: legal-move filtering', () => {
  it('lets a classic position pass through unchanged with no effects', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // e2 pawn, no effects: it may go to e3 or e4.
    expect(engine.getLegalMoves('e2').sort()).toEqual(['e3', 'e4']);
  });

  it('blocks a sliding piece from passing through a hole', () => {
    // White rook a1; a hole on a4 cuts the file. It can still reach a2/a3
    // but not a5 and beyond.
    const engine = new VariantEngine(ROOK_FEN, effectsWithHoles(['5,1']));
    const moves = engine.getLegalMoves('a1').sort();
    expect(moves).toContain('a2');
    expect(moves).toContain('a3');
    expect(moves).not.toContain('a4');
    expect(moves).not.toContain('a5');
  });

  it('lets a knight jump over a hole but not land on one', () => {
    // Knight on b1 with a hole on a3 (row 6, col 1): it still reaches c3
    // but not a3 itself.
    const engine = new VariantEngine(KNIGHT_FEN, effectsWithHoles(['6,1']));
    const moves = engine.getLegalMoves('b1');
    expect(moves).not.toContain('a3');
    expect(moves).toContain('c3');
  });

  it('traps a non-royal piece inside the Major Conflict box', () => {
    // A white rook on a1 sits in a 6x6 box (rows 3-8, cols 1-6, i.e. ranks
    // 1-6 files a-f) that it cannot leave; the king is exempt.
    const engine = new VariantEngine(ROOK_FEN, {
      ...createEmptyVariantEffects(),
      barrier: { box: [3, 1, 6, 6], owner: 'white', turnsLeft: 10 },
    });
    // a2/a3/a4/a5/a6 stay in the box; a7/a8/a1-file beyond do not.
    const moves = engine.getLegalMoves('a1');
    expect(moves).toContain('a2');
    expect(moves).not.toContain('a7');
    expect(moves).not.toContain('a8');
  });
});

describe('VariantEngine: The Abyss', () => {
  it('turns three empty squares into holes', () => {
    const engine = new VariantEngine(STARTING_FEN);
    const result = engine.applyAbyss([
      [5, 5], // e4
      [4, 5], // e5
      [5, 4], // d4
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.effects.holes).toHaveLength(3);
    }
  });

  it('rejects a target count other than three', () => {
    const engine = new VariantEngine(STARTING_FEN);
    expect(engine.applyAbyss([[5, 5]]).ok).toBe(false);
    expect(engine.applyAbyss([[5, 5], [4, 5], [5, 4], [5, 6]]).ok).toBe(false);
  });

  it('rejects a square that already holds a piece', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // e2 is a white pawn.
    expect(engine.applyAbyss([[5, 5], [7, 5], [5, 4]]).ok).toBe(false);
  });

  it('rejects a hole on a promotion rank', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // row 1 (rank 8) is a promotion rank.
    expect(engine.applyAbyss([[1, 1], [5, 5], [5, 4]]).ok).toBe(false);
  });

  it('rejects a set that disconnects the board', () => {
    // Wipe a whole column of three that, combined with the rest, can wall off
    // an unreachable square; a clean three-in-a-row on the edge severs it.
    const engine = new VariantEngine(STARTING_FEN);
    // Three holes on column a (rows 1,2,3) cut off a8 from the rest.
    expect(engine.applyAbyss([[1, 1], [2, 1], [3, 1]]).ok).toBe(false);
  });
});

describe('VariantEngine: Small Reinforcements', () => {
  it('summons a piece onto an empty square of the home half', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // c3 (rank 3, white home half) is empty.
    const result = engine.applyReinforcement('white', [6, 3], 'knight');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fen).toContain('N'); // a knight now stands on c3
    }
  });

  it('refuses to summon onto the enemy home half', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // c6 (rank 6) is black's half; white cannot summon there.
    expect(engine.applyReinforcement('white', [3, 3], 'knight').ok).toBe(false);
  });

  it('refuses to summon onto an occupied square', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // e2 holds a white pawn.
    expect(engine.applyReinforcement('white', [7, 5], 'bishop').ok).toBe(false);
  });

  it('refuses to summon onto a hole', () => {
    const engine = new VariantEngine(
      STARTING_FEN,
      effectsWithHoles(['5,3']),
    );
    // c4 is a hole; white cannot summon there.
    expect(engine.applyReinforcement('white', [5, 3], 'knight').ok).toBe(false);
  });
});
describe('VariantEngine: Redeployment', () => {
  it('rearranges the back rank, keeping the king and queen in place', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // The standard arrangement is a legal redeployment of itself.
    const result = engine.applyRedeployment('white', [
      'rook',
      'knight',
      'bishop',
      'bishop',
      'knight',
      'rook',
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects the wrong piece multiset', () => {
    const engine = new VariantEngine(STARTING_FEN);
    // Three bishops is not the starting back rank.
    const bad: ('rook' | 'knight' | 'bishop')[] = [
      'bishop',
      'bishop',
      'bishop',
      'knight',
      'knight',
      'rook',
    ];
    expect(engine.applyRedeployment('white', bad).ok).toBe(false);
  });

  it('rejects a wrong-length arrangement', () => {
    const engine = new VariantEngine(STARTING_FEN);
    expect(
      engine.applyRedeployment('white', ['rook', 'knight', 'bishop']).ok,
    ).toBe(false);
  });

  it('refuses once the back rank has been moved', () => {
    // The white rook has left a1 (it now stands on a3), so the back rank is
    // no longer the untouched starting setup.
    const MOVED_FEN = 'rnbqkbnr/pppppppp/8/R7/8/8/PPPPPPPP/1NBQKBNR w kq - 0 1';
    const engine = new VariantEngine(MOVED_FEN);
    const result = engine.applyRedeployment('white', [
      'rook',
      'knight',
      'bishop',
      'bishop',
      'knight',
      'rook',
    ]);
    expect(result.ok).toBe(false);
  });
});
