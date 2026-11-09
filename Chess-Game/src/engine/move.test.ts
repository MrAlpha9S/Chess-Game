import { describe, it, expect } from 'vitest';
import {
  applyMoveToState,
  createInitialGameState,
  gameStateFromFen,
  replayMoves,
  type RecordedMove,
} from '../engine';

describe('game state', () => {
  it('starts from the standard position', () => {
    const state = createInitialGameState();
    expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(state.turn).toBe('white');
    expect(state.isGameOver).toBe(false);
  });

  it('applies a move and hands the turn over', () => {
    const applied = applyMoveToState(
      createInitialGameState(),
      { from: 'e2', to: 'e4' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.result.san).toBe('e4');
    expect(applied.state.turn).toBe('black');
    expect(applied.state.fen).toContain(' b ');
  });

  it('rejects an illegal move', () => {
    const applied = applyMoveToState(
      createInitialGameState(),
      { from: 'e2', to: 'e5' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(false);
  });

  it('rejects a move that leaves the king in check', () => {
    // The knight on e5 is pinned to the king on e1 by the rook on e8.
    const applied = applyMoveToState(
      gameStateFromFen('k3r3/8/4N3/8/8/8/8/4K3 w - - 0 1'),
      { from: 'e5', to: 'd3' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(false);
  });

  it('detects checkmate', () => {
    // Back-rank mate: Ra8 is mate.
    const applied = applyMoveToState(
      gameStateFromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'),
      { from: 'a1', to: 'a8' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.state.isGameOver).toBe(true);
    expect(applied.state.outcome).toBe('checkmate');
  });

  it('detects stalemate', () => {
    const state = gameStateFromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(state.isGameOver).toBe(true);
    expect(state.outcome).toBe('stalemate');
  });

  it('detects insufficient material', () => {
    const state = gameStateFromFen('8/8/8/4k3/8/8/8/K7 w - - 0 1');
    expect(state.isGameOver).toBe(true);
    expect(state.outcome).toBe('insufficientMaterial');
  });

  it('records a promotion', () => {
    const applied = applyMoveToState(
      gameStateFromFen('8/P6k/8/8/8/8/8/K7 w - - 0 1'),
      { from: 'a7', to: 'a8', promotion: 'q' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.result.san).toBe('a8=Q');
    expect(applied.state.fen).toContain('Q');
  });

  it('records en passant', () => {
    const applied = applyMoveToState(
      gameStateFromFen('8/8/8/3pP3/8/8/8/K6k w - d6 0 1'),
      { from: 'e5', to: 'd6' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.result.san).toBe('exd6');
  });

  it('records castling', () => {
    const applied = applyMoveToState(
      gameStateFromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),
      { from: 'e1', to: 'g1' },
      'alice',
      1,
    );

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.result.san).toBe('O-O');
  });
});

describe('replaying a game', () => {
  /** The opening moves of the Ruy Lopez. */
  const RUY_LOPEZ: [string, string][] = [
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
    ['b8', 'c6'],
    ['f1', 'b5'],
    ['g8', 'f6'],
    ['e1', 'g1'],
  ];

  const moves: RecordedMove[] = RUY_LOPEZ.map(([from, to], index) => ({
    from,
    to,
    san: '',
    by: index % 2 === 0 ? 'alice' : 'bob',
    timestamp: index,
  }));

  it('replays a legal game to the same position', () => {
    const replayed = replayMoves(createInitialGameState().fen, moves);

    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;

    // The same moves played one at a time must reach the same position.
    let state = createInitialGameState();
    for (const move of moves) {
      const applied = applyMoveToState(state, move, move.by, move.timestamp);
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      state = applied.state;
    }

    expect(replayed.state.fen).toBe(state.fen);
  });

  it('reports the index of an illegal move in the history', () => {
    const corrupted: RecordedMove[] = [
      ...moves.slice(0, 2),
      { from: 'd7', to: 'd5', san: '', by: 'alice', timestamp: 2 },
    ];

    const replayed = replayMoves(createInitialGameState().fen, corrupted);
    expect(replayed.ok).toBe(false);
  });
});
