/**
 * The dimensions of the board matrix.
 *
 * The board is always a fixed 10x10 matrix of coordinates. In Phase 1 the
 * classic 8x8 playfield is the centred block of rows 1..8 and columns 1..8,
 * so exactly 36 of the 100 squares (the outer ring) are locked. Phase 2 card
 * mechanics unlock squares or punch holes into this grid without ever
 * re-indexing coordinates.
 *
 * Row 1 holds the black back rank (chess rank 8) and row 8 the white back
 * rank (chess rank 1), so the grid reads top-down from black's side. Column
 * 1 is the a-file and column 8 the h-file.
 *
 * This module holds only constants so that both `coords` and
 * `BoardGrid10x10` can import it without a cycle.
 */

/** The edge length of the board matrix. */
export const GRID_SIZE = 10;

/** First row of the classic 8x8 active region. */
export const ACTIVE_MIN_ROW = 1;
/** Last row of the classic 8x8 active region. */
export const ACTIVE_MAX_ROW = 8;
/** First column of the classic 8x8 active region. */
export const ACTIVE_MIN_COL = 1;
/** Last column of the classic 8x8 active region. */
export const ACTIVE_MAX_COL = 8;

/** The edge length of the active playfield. */
export const ACTIVE_SIZE = 8;

/** The number of squares locked away in the outer ring. */
export const LOCKED_SQUARE_COUNT = GRID_SIZE * GRID_SIZE - ACTIVE_SIZE * ACTIVE_SIZE;
