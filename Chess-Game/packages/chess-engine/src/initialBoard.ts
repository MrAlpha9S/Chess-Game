/**
 * The game's initial board, as a 10x10 grid of piece codes.
 *
 * The board is always stored as a 10x10 grid; in classic mode the 64 middle
 * squares (rows 2..9, cols 0..7) are the active playfield and the outer ring
 * is locked. Card modes may unlock parts of that ring.
 *
 * Row 2 holds the black back rank (chess rank 8) and row 9 the white back
 * rank (chess rank 1), so the grid reads top-down from black's side.
 */

import { GRID_SIZE } from './coords';
import type { GridBoard } from './board';

/** Create the classic starting position on the 10x10 grid. */
export function createInitialBoard(): GridBoard {
  const board: GridBoard = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ''),
  );

  // Black back rank (rank 8) and pawns (rank 7).
  board[2] = ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br', '', ''];
  board[3] = ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', '', ''];

  // White pawns (rank 2) and back rank (rank 1).
  board[8] = ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', '', ''];
  board[9] = ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', '', ''];

  return board;
}
