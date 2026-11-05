import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import {
  applyMove,
  createInitialEngineState,
  legalMovesFrom,
  replayMoves,
  stateToFen,
  toPosition,
  type EngineState,
} from './index';
import { gridToSquare, squareToGrid } from './coords';
import { createInitialBoard } from './initialBoard';

describe('coords', () => {
  it('maps the grid corners to the right chess squares', () => {
    // Grid row 2 is the black back rank (rank 8), row 9 the white back rank (rank 1).
    expect(gridToSquare(2, 0)).toBe(56); // a8
    expect(gridToSquare(9, 7)).toBe(7); // h1
    expect(gridToSquare(9, 0)).toBe(0); // a1
    expect(gridToSquare(2, 7)).toBe(63); // h8
  });

  it('round-trips every square', () => {
    for (let square = 0; square < 64; square++) {
      const coord = squareToGrid(square)!;
      expect(gridToSquare(coord.row, coord.col)).toBe(square);
    }
  });

  it('rejects squares outside the active 8x8 region', () => {
    expect(gridToSquare(1, 0)).toBeNull();
    expect(gridToSquare(2, 8)).toBeNull();
    expect(gridToSquare(10, 0)).toBeNull();
  });
});

describe('initial position', () => {
  const state = createInitialEngineState(createInitialBoard());

  it('produces the standard starting FEN', () => {
    expect(stateToFen(state)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });

  it('maps onto a legal chessops position', () => {
    const position = toPosition(state);
    expect(position).not.toBeNull();
    expect(position!.turn).toBe('white');
  });

  it('gives the knight its two legal openings', () => {
    const dests = legalMovesFrom(state, 9, 1); // b1 knight
    expect(dests).toHaveLength(2);
    expect(dests).toEqual(
      expect.arrayContaining([
        { row: 7, col: 0 }, // a3
        { row: 7, col: 2 }, // c3
      ]),
    );
  });

  it('does not let a pinned piece leave the file', () => {
    const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ''));
    // White rook e2 (row 8) and king e1 (row 9), black rook e8 (row 2),
    // black king a8 (row 2, col 0).
    grid[8][4] = 'wr';
    grid[9][4] = 'wk';
    grid[2][4] = 'br';
    grid[2][0] = 'bk';

    const pinnedState: EngineState = {
      board: grid,
      turn: 'white',
      castlingRights: [],
      epSquare: undefined,
      halfmoves: 0,
      fullmoves: 1,
    };

    // The rook on e2 is pinned against the king on e1 by the rook on e8, so it
    // may only move along the e-file - never sideways.
    const dests = legalMovesFrom(pinnedState, 8, 4);
    expect(dests.length).toBeGreaterThan(0);
    expect(dests.every((d) => d.col === 4)).toBe(true);
    expect(dests.some((d) => d.row === 8)).toBe(false); // never stays put
  });
});

describe('applyMove', () => {
  const state = createInitialEngineState(createInitialBoard());

  it('applies 1. e4 and returns the right SAN', () => {
    const result = applyMove(state, { row: 8, col: 4 }, { row: 6, col: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.san).toBe('e4');
    expect(result.board[6][4]).toBe('wp');
    expect(result.board[8][4]).toBe('');
    expect(result.nextTurn).toBe('black');
    expect(result.outcome).toEqual({ type: 'ongoing' });
  });

  it('rejects an illegal move', () => {
    const result = applyMove(state, { row: 8, col: 4 }, { row: 7, col: 5 });
    expect(result.ok).toBe(false);
  });

  it('rejects moving the opponent piece', () => {
    const result = applyMove(state, { row: 3, col: 0 }, { row: 4, col: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects a move that leaves the king in check', () => {
    const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ''));
    grid[9][4] = 'wk'; // e1
    grid[0][4] = 'br'; // off-board region, ignored
    grid[2][4] = 'bq'; // e8 queen, pins the e-file
    grid[6][4] = 'wr'; // e4 rook, pinned by the queen

    const pinned: EngineState = {
      board: grid,
      turn: 'white',
      castlingRights: [],
      epSquare: undefined,
      halfmoves: 0,
      fullmoves: 1,
    };

    const sideways = applyMove(pinned, { row: 6, col: 4 }, { row: 6, col: 3 });
    expect(sideways.ok).toBe(false);

    // Along the pin line the rook is blocked by the queen anyway.
    const forward = applyMove(pinned, { row: 6, col: 4 }, { row: 5, col: 4 });
    expect(forward.ok).toBe(false);
  });

  it('detects checkmate', () => {
    // Fool's mate position: after 1. f3 e5 2. g4 Qh4#
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const setup = parseFen(fen);
    expect(setup.isOk).toBe(true);
    if (!setup.isOk) return;

    const chess = Chess.fromSetup(setup.value);
    expect(chess.isOk).toBe(true);
    if (!chess.isErr) {
      expect(chess.value.isCheckmate()).toBe(true);
      expect(chess.value.outcome()).toEqual({ winner: 'black' });
    }
  });

  it('records a capture', () => {
    // 1. e4 d5 2. exd5
    const afterE4 = applyMove(state, { row: 8, col: 4 }, { row: 6, col: 4 });
    expect(afterE4.ok).toBe(true);
    if (!afterE4.ok) return;

    const afterD5 = applyMove(
      {
        board: afterE4.board,
        turn: afterE4.nextTurn,
        castlingRights: afterE4.castlingRights,
        epSquare: afterE4.epSquare,
        halfmoves: afterE4.halfmoves,
        fullmoves: afterE4.fullmoves,
      },
      { row: 3, col: 3 },
      { row: 5, col: 3 },
    );
    expect(afterD5.ok).toBe(true);
    if (!afterD5.ok) return;
    expect(afterD5.san).toBe('d5');

    const afterExd5 = applyMove(
      {
        board: afterD5.board,
        turn: afterD5.nextTurn,
        castlingRights: afterD5.castlingRights,
        epSquare: afterD5.epSquare,
        halfmoves: afterD5.halfmoves,
        fullmoves: afterD5.fullmoves,
      },
      { row: 6, col: 4 },
      { row: 5, col: 3 },
    );
    expect(afterExd5.ok).toBe(true);
    if (!afterExd5.ok) return;
    expect(afterExd5.capturedPiece).toBe('bp');
    expect(afterExd5.san).toBe('exd5');
  });
});

describe('replayMoves', () => {
  it('replays a game to the same position', () => {
    const initial = createInitialEngineState(createInitialBoard());
    const moves = [
      { fromRow: 8, fromCol: 4, toRow: 6, toCol: 4 }, // e4
      { fromRow: 3, fromCol: 4, toRow: 5, toCol: 4 }, // e5
      { fromRow: 9, fromCol: 6, toRow: 7, toCol: 5 }, // Nf3
      { fromRow: 2, fromCol: 1, toRow: 4, toCol: 2 }, // Nc6
    ];

    const result = replayMoves(initial, moves);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(stateToFen(result.state)).toBe(
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    );
  });

  it('reports the index of the first illegal move', () => {
    const initial = createInitialEngineState(createInitialBoard());
    const moves = [
      { fromRow: 8, fromCol: 4, toRow: 6, toCol: 4 }, // e4
      { fromRow: 8, fromCol: 4, toRow: 6, toCol: 4 }, // e4 again - illegal
    ];

    const result = replayMoves(initial, moves);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.index).toBe(1);
  });
});
