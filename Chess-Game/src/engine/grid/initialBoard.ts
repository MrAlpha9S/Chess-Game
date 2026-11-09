/**
 * The classic starting position on the 10x10 grid.
 *
 * The board is always a 10x10 grid; in classic mode the centred 8x8 block
 * (rows 1..8, columns 1..8) is active and the outer ring is locked. Card
 * modes may unlock parts of that ring.
 *
 * Row 1 holds the black back rank (chess rank 8) and row 8 the white back
 * rank (chess rank 1), so the grid reads top-down from black's side.
 */

import { GRID_SIZE } from './constants';
import type { GridBoard } from './board';

/** Create the classic starting position on the 10x10 grid. */
export function createInitialBoard(): GridBoard {
  const board: GridBoard = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ''),
  );

  // Black back rank (rank 8) on row 1, black pawns (rank 7) on row 2.
  board[1] = ['', 'br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br', ''];
  board[2] = ['', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', ''];

  // White pawns (rank 2) on row 7, white back rank (rank 1) on row 8.
  board[7] = ['', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', ''];
  board[8] = ['', 'wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', ''];

  return board;
}
