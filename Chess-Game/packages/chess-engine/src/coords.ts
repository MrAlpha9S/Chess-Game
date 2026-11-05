/**
 * Mapping between the game's 10x10 data grid and chessops' 8x8 board.
 *
 * The game stores the board as a 10x10 grid (rows 0..9 top-to-bottom, cols 0..9
 * left-to-right). The active 8x8 playfield lives at rows 2..9, cols 0..7 in
 * "classic" mode; the surrounding ring is locked (card modes may unlock it).
 *
 * chessops uses a 64-square bitboard indexed as:
 *   square = (rank - 1) * 8 + file      rank 1..8, file 0..7 (a..h)
 *
 * Mapping (classic 8x8 active region):
 *   grid row ri (2..9) -> chess rank = 10 - ri   (row 2 = rank 8, row 9 = rank 1)
 *   grid col ci (0..7) -> chess file = ci
 *   chessops square   = (9 - ri) * 8 + ci
 *
 * Note: grid row 9 holds the white back rank (rank 1) and row 2 the black back
 * rank (rank 8), i.e. the grid is drawn from black's side downward, matching
 * the top-down rendering in BoardGrid.tsx.
 */

export const GRID_SIZE = 10;
export const ACTIVE_ROW_START = 2;
export const ACTIVE_COL_START = 0;
export const ACTIVE_SIZE = 8;

/** Grid row of each chess rank (1..8). rank 8 -> row 2, rank 1 -> row 9. */
export const RANK_TO_ROW = [9, 8, 7, 6, 5, 4, 3, 2] as const;

/** Grid column of each chess file index (0..7). */
export const FILE_TO_COL = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** True when the grid coordinate lies inside the classic 8x8 active region. */
export function isActive(row: number, col: number): boolean {
  return (
    row >= ACTIVE_ROW_START &&
    row < GRID_SIZE &&
    col >= ACTIVE_COL_START &&
    col < ACTIVE_COL_START + ACTIVE_SIZE
  );
}

/**
 * Convert a chessops square index (0..63) to a grid coordinate.
 * Returns null when the square falls outside the classic active region.
 */
export function squareToGrid(square: number): { row: number; col: number } | null {
  if (square < 0 || square > 63) return null;
  const file = square % 8;
  const rank = Math.floor(square / 8) + 1; // 1..8
  return { row: RANK_TO_ROW[rank - 1], col: FILE_TO_COL[file] };
}

/**
 * Convert a grid coordinate to a chessops square index (0..63).
 * Returns null when the coordinate is outside the classic active region.
 */
export function gridToSquare(row: number, col: number): number | null {
  if (!isActive(row, col)) return null;
  return (9 - row) * 8 + col;
}

/** Chess rank (1..8) of a grid row, or null if outside the active region. */
export function rowToRank(row: number): number | null {
  if (row < ACTIVE_ROW_START || row >= GRID_SIZE) return null;
  return 10 - row;
}

/** Chess file index (0..7 = a..h) of a grid column, or null if outside. */
export function colToFile(col: number): number | null {
  if (col < ACTIVE_COL_START || col >= ACTIVE_COL_START + ACTIVE_SIZE) return null;
  return col - ACTIVE_COL_START;
}
