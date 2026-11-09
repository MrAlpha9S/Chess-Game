import { describe, expect, it } from 'vitest';
import {
  ACTIVE_MAX_COL,
  ACTIVE_MAX_ROW,
  ACTIVE_MIN_COL,
  ACTIVE_MIN_ROW,
  BoardGrid10x10,
  GRID_SIZE,
  LOCKED_SQUARE_COUNT,
  StandardEngine,
  algebraicToGrid,
  applyMoveToState,
  createInitialBoard,
  createInitialGameState,
  fenToGrid,
  gameStateFromFen,
  gridToAlgebraic,
  gridToSquare,
  squareToGrid,
  type RecordedMove,
} from './index';

describe('grid geometry', () => {
  it('maps the corners of the active region to the right chess squares', () => {
    // Grid row 1 is the black back rank (rank 8), row 8 the white back rank.
    expect(gridToSquare(1, 1)).toBe(56); // a8
    expect(gridToSquare(8, 8)).toBe(7); // h1
    expect(gridToSquare(8, 1)).toBe(0); // a1
    expect(gridToSquare(1, 8)).toBe(63); // h8
  });

  it('round-trips every square', () => {
    for (let square = 0; square < 64; square++) {
      const coord = squareToGrid(square)!;
      expect(gridToSquare(coord.row, coord.col)).toBe(square);
    }
  });

  it('rejects squares outside the active 8x8 region', () => {
    expect(gridToSquare(0, 1)).toBeNull();
    expect(gridToSquare(9, 1)).toBeNull();
    expect(gridToSquare(1, 0)).toBeNull();
    expect(gridToSquare(8, 9)).toBeNull();
  });

  it('locks exactly the 36 outer squares', () => {
    expect(LOCKED_SQUARE_COUNT).toBe(36);
    expect(GRID_SIZE * GRID_SIZE - ACTIVE_MIN_ROW * ACTIVE_MIN_COL).toBeGreaterThan(0);

    const grid = new BoardGrid10x10(true);
    let playable = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid.isSquarePlayable(row, col)) playable++;
      }
    }
    expect(playable).toBe(64);
  });

  it('keeps the active region centred', () => {
    expect(ACTIVE_MIN_ROW).toBe(1);
    expect(ACTIVE_MAX_ROW).toBe(8);
    expect(ACTIVE_MIN_COL).toBe(1);
    expect(ACTIVE_MAX_COL).toBe(8);
  });

  it('converts between algebraic notation and grid coordinates', () => {
    expect(algebraicToGrid('a8')).toEqual({ row: 1, col: 1 });
    expect(algebraicToGrid('h1')).toEqual({ row: 8, col: 8 });
    expect(algebraicToGrid('e4')).toEqual({ row: 5, col: 5 });
    expect(gridToAlgebraic(1, 1)).toBe('a8');
    expect(gridToAlgebraic(8, 8)).toBe('h1');
    expect(gridToAlgebraic(5, 5)).toBe('e4');
  });
});

describe('initial position', () => {
  const board = createInitialBoard();

  it('places the pieces on the right squares', () => {
    // White's back rank on grid row 8, columns 1..8.
    expect(board[8].slice(1, 9)).toEqual(['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']);
    // White's pawns on grid row 7.
    expect(board[7].slice(1, 9)).toEqual(['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp']);
    // Black's back rank on grid row 1.
    expect(board[1].slice(1, 9)).toEqual(['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br']);
    // Black's pawns on grid row 2.
    expect(board[2].slice(1, 9)).toEqual(['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp']);
  });

  it('leaves the outer ring empty', () => {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (row >= 1 && row <= 8 && col >= 1 && col <= 8) continue;
        expect(board[row][col]).toBe('');
      }
    }
  });

  it('round-trips through the FEN', () => {
    const grid = fenToGrid(createInitialGameState().fen);
    expect(grid[8].slice(1, 9)).toEqual(['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']);
    expect(grid[1].slice(1, 9)).toEqual(['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br']);
  });
});

describe('StandardEngine', () => {
  it('starts with white to move and the standard position', () => {
    const engine = new StandardEngine();
    expect(engine.getTurn()).toBe('white');
    expect(engine.getFen()).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(engine.isGameOver()).toBe(false);
  });

  it('offers the four opening moves for a knight', () => {
    const engine = new StandardEngine();
    const moves = engine.getLegalMoves('b1').sort();
    expect(moves).toEqual(['a3', 'c3']);
  });

  it('offers two opening moves for the e-pawn', () => {
    const engine = new StandardEngine();
    expect(engine.getLegalMoves('e2').sort()).toEqual(['e3', 'e4']);
  });

  it('plays a legal move and reports the new position', () => {
    const engine = new StandardEngine();
    const result = engine.makeMove({ from: 'e2', to: 'e4' });
    expect(result.isValid).toBe(true);
    expect(result.san).toBe('e4');
    expect(result.nextTurn).toBe('black');
    expect(result.newFen).toContain(' b ');
  });

  it('rejects an illegal move', () => {
    const engine = new StandardEngine();
    const result = engine.makeMove({ from: 'e2', to: 'e5' });
    expect(result.isValid).toBe(false);
    expect(result.errorReason).toBeTruthy();
  });

  it('rejects moving the opponent piece', () => {
    const engine = new StandardEngine();
    const result = engine.makeMove({ from: 'e7', to: 'e5' });
    expect(result.isValid).toBe(false);
  });

  it('rejects moving a piece while in check', () => {
    // The white king on e1 is checked by the rook on a1 and cannot step
    // along the rank to d1.
    const engine = new StandardEngine('k7/8/8/8/8/8/8/r3K3 w - - 0 1');
    expect(engine.getLegalMoves('e1')).not.toContain('d1');

    const result = engine.makeMove({ from: 'e1', to: 'd1' });
    expect(result.isValid).toBe(false);
  });

  it('rejects moving a pinned piece off the pin line', () => {
    // The knight on e5 is pinned to the king on e1 by the rook on e8.
    const engine = new StandardEngine('k3r3/8/4N3/8/8/8/8/4K3 w - - 0 1');
    expect(engine.getLegalMoves('e5')).toEqual([]);

    const result = engine.makeMove({ from: 'e5', to: 'd3' });
    expect(result.isValid).toBe(false);
  });

  it('detects checkmate', () => {
    // Back-rank mate: the rook reaches a8 and the king has no escape.
    const engine = new StandardEngine('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    const result = engine.makeMove({ from: 'a1', to: 'a8' });
    expect(result.isValid).toBe(true);
    expect(result.isCheckmate).toBe(true);
    expect(engine.isGameOver()).toBe(true);
    expect(engine.getOutcome()).toBe('checkmate');
  });

  it('detects stalemate', () => {
    const engine = new StandardEngine('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    const result = engine.makeMove({ from: 'h8', to: 'g8' });
    expect(result.isValid).toBe(false);
    expect(engine.isGameOver()).toBe(true);
    expect(engine.getOutcome()).toBe('stalemate');
  });

  it('detects insufficient material', () => {
    const engine = new StandardEngine('8/8/8/4k3/8/8/8/K7 w - - 0 1');
    expect(engine.isGameOver()).toBe(true);
    expect(engine.getOutcome()).toBe('insufficientMaterial');
  });

  it('handles castling', () => {
    const engine = new StandardEngine('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const result = engine.makeMove({ from: 'e1', to: 'g1' });
    expect(result.isValid).toBe(true);
    expect(result.san).toBe('O-O');
  });

  it('handles en passant', () => {
    const engine = new StandardEngine('8/8/8/3pP3/8/8/8/K6k w - d6 0 1');
    const result = engine.makeMove({ from: 'e5', to: 'd6' });
    expect(result.isValid).toBe(true);
    expect(result.san).toBe('exd6');
  });

  it('requires a promotion piece', () => {
    const engine = new StandardEngine('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    const result = engine.makeMove({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(result.isValid).toBe(true);
    expect(result.san).toBe('e8=Q');
  });

  it('reports legal moves as grid coordinates', () => {
    const engine = new StandardEngine();
    const moves = engine.getLegalGridMoves('b1');
    // b1's destinations are a3 and c3: grid row 6, columns 1 and 3.
    expect(moves).toEqual(expect.arrayContaining([{ row: 6, col: 1 }, { row: 6, col: 3 }]));
  });
});

describe('applyMoveToState', () => {
  it('advances the position and records the move', () => {
    const state = createInitialGameState();
    const applied = applyMoveToState(state, { from: 'e2', to: 'e4' }, 'user-1', 1000);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.state.fen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b');
    expect(applied.state.turn).toBe('black');
    expect(applied.state.lastMove?.san).toBe('e4');
    expect(applied.state.lastMove?.by).toBe('user-1');
    expect(applied.state.lastMove?.timestamp).toBe(1000);
  });

  it('refuses an illegal move without changing the state', () => {
    const state = createInitialGameState();
    const applied = applyMoveToState(state, { from: 'e2', to: 'e5' }, 'user-1', 1000);
    expect(applied.ok).toBe(false);
  });

  it('replays a move list to the same position', () => {
    const moves: RecordedMove[] = [
      { from: 'e2', to: 'e4', san: 'e4', by: 'a', timestamp: 1 },
      { from: 'e7', to: 'e5', san: 'e5', by: 'b', timestamp: 2 },
      { from: 'g1', to: 'f3', san: 'Nf3', by: 'a', timestamp: 3 },
    ];

    let fen = createInitialGameState().fen;
    for (const move of moves) {
      const applied = applyMoveToState(
        { fen },
        { from: move.from, to: move.to, promotion: move.promotion as 'q' },
        move.by,
        move.timestamp,
      );
      expect(applied.ok).toBe(true);
      if (applied.ok) fen = applied.state.fen;
    }

    const replayed = gameStateFromFen(fen);
    expect(replayed.turn).toBe('white');
    expect(replayed.fullMoveNumber).toBe(2);
  });
});
