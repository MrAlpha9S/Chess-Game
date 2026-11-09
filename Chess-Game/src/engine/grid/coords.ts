/**
 * Mapping between the 10x10 board grid and chessops' 8x8 board.
 *
 * The game always stores the board as a 10x10 matrix of coordinates. In
 * Phase 1 the classic 8x8 playfield is the centred block of rows 1..8 and
 * columns 1..8; the surrounding ring is locked and may be unlocked by cards
 * in Phase 2.
 *
 * chessops indexes its 64 squares as:
 *   square = (rank - 1) * 8 + file      rank 1..8, file 0..7 (a..h)
 *
 * Mapping (active 8x8 region):
 *   grid row r (1..8)  -> chess rank = 9 - r   (row 1 = rank 8, row 8 = rank 1)
 *   grid col c (1..8)  -> chess file  = c - 1
 *   chessops square    = (8 - r) * 8 + (c - 1)
 */

import {
  ACTIVE_MAX_COL,
  ACTIVE_MAX_ROW,
  ACTIVE_MIN_COL,
  ACTIVE_MIN_ROW,
  GRID_SIZE,
} from './constants';

/** Grid row of each chess rank. Index 0 is rank 1, so row 8. */
export const RANK_TO_ROW = [8, 7, 6, 5, 4, 3, 2, 1] as const;

/** Grid column of each chess file index (0..7 = a..h). */
export const FILE_TO_COL = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** A coordinate on the 10x10 matrix. Both values run from 0 to 9. */
export interface Coordinate {
  row: number;
  col: number;
}

/** True when the coordinate lies inside the classic 8x8 active region. */
export function isActive(row: number, col: number): boolean {
  return (
    row >= ACTIVE_MIN_ROW &&
    row <= ACTIVE_MAX_ROW &&
    col >= ACTIVE_MIN_COL &&
    col <= ACTIVE_MAX_COL
  );
}

/**
 * Convert a chessops square index (0..63) to a grid coordinate.
 * Returns null when the square falls outside the active region.
 */
export function squareToGrid(square: number): Coordinate | null {
  if (square < 0 || square > 63) return null;
  const file = square % 8;
  const rank = Math.floor(square / 8) + 1;
  return { row: RANK_TO_ROW[rank - 1], col: FILE_TO_COL[file] };
}

/**
 * Convert a grid coordinate to a chessops square index (0..63).
 * Returns null when the coordinate is outside the active region.
 */
export function gridToSquare(row: number, col: number): number | null {
  if (!isActive(row, col)) return null;
  return (8 - row) * 8 + (col - ACTIVE_MIN_COL);
}

/** Chess rank (1..8) of a grid row, or null if outside the active region. */
export function rowToRank(row: number): number | null {
  if (row < ACTIVE_MIN_ROW || row > ACTIVE_MAX_ROW) return null;
  return 9 - row;
}

/** Chess file index (0..7 = a..h) of a grid column, or null if outside. */
export function colToFile(col: number): number | null {
  if (col < ACTIVE_MIN_COL || col > ACTIVE_MAX_COL) return null;
  return col - ACTIVE_MIN_COL;
}

/**
 * Convert a grid coordinate to algebraic notation ("e4").
 *
 * The a-file is column 1 and rank 8 is row 1, matching the board's
 * top-down rendering from black's side.
 */
export function gridToAlgebraic(row: number, col: number): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + (col - ACTIVE_MIN_COL));
  const rank = 9 - row;
  return `${file}${rank}`;
}

/**
 * Convert algebraic notation ("e4") to a grid coordinate.
 */
export function algebraicToGrid(square: string): Coordinate {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  return { row: 9 - rank, col: file + 1 };
}

/** The number of squares on the whole 10x10 matrix. */
export const TOTAL_SQUARES = GRID_SIZE * GRID_SIZE;
