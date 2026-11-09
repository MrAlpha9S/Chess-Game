/**
 * The 10x10 board grid and its active region.
 *
 * Manages which squares are playable, which are locked and which are holes.
 * The class is free of chess rules — it only knows geometry, so it can be
 * reused by the card variant layer unchanged.
 */

import { algebraicToGrid, gridToAlgebraic, type Coordinate } from './coords';
import {
  ACTIVE_MAX_COL,
  ACTIVE_MAX_ROW,
  ACTIVE_MIN_COL,
  ACTIVE_MIN_ROW,
} from './constants';

/** The active region of the grid, as bounds. */
export interface GridBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

/** The Phase 1 active region: the centred 8x8 block of the 10x10 matrix. */
export const PHASE_1_BOUNDS: GridBounds = {
  minRow: ACTIVE_MIN_ROW,
  maxRow: ACTIVE_MAX_ROW,
  minCol: ACTIVE_MIN_COL,
  maxCol: ACTIVE_MAX_COL,
};

/** The fully-open 10x10 region, used once card effects start unlocking it. */
const FULL_BOUNDS: GridBounds = {
  minRow: 0,
  maxRow: 9,
  minCol: 0,
  maxCol: 9,
};

/**
 * Manages the 10x10 coordinate matrix: which squares are playable, which are
 * locked and which are holes.
 */
export class BoardGrid10x10 {
  private activeBounds: GridBounds;
  private readonly holes = new Set<string>();

  constructor(isPhase1: boolean = true) {
    this.activeBounds = isPhase1 ? { ...PHASE_1_BOUNDS } : { ...FULL_BOUNDS };
  }

  /** Restore the classic 8x8 centred playfield and clear every hole. */
  public resetToPhase1Bounds(): void {
    this.activeBounds = { ...PHASE_1_BOUNDS };
    this.holes.clear();
  }

  /** The current active region. */
  public getBounds(): GridBounds {
    return { ...this.activeBounds };
  }

  /** True when the square exists on the board and is neither locked nor a hole. */
  public isSquarePlayable(row: number, col: number): boolean {
    if (row < 0 || row > 9 || col < 0 || col > 9) {
      return false;
    }
    if (
      row < this.activeBounds.minRow ||
      row > this.activeBounds.maxRow ||
      col < this.activeBounds.minCol ||
      col > this.activeBounds.maxCol
    ) {
      return false;
    }
    return !this.holes.has(`${row},${col}`);
  }

  /** True when the square is on the board but currently blocked. */
  public isSquareBlocked(row: number, col: number): boolean {
    if (row < 0 || row > 9 || col < 0 || col > 9) {
      return true;
    }
    return !this.isSquarePlayable(row, col);
  }

  /** The holes currently punched into the grid. */
  public getHoles(): string[] {
    return [...this.holes];
  }

  /**
   * Phase 2 extensibility: widen the active region so the given square
   * becomes playable.
   */
  public unlockSquare(row: number, col: number): void {
    this.activeBounds.minRow = Math.min(this.activeBounds.minRow, row);
    this.activeBounds.maxRow = Math.max(this.activeBounds.maxRow, row);
    this.activeBounds.minCol = Math.min(this.activeBounds.minCol, col);
    this.activeBounds.maxCol = Math.max(this.activeBounds.maxCol, col);
  }

  /**
   * Phase 2 extensibility: destroy a square. Sliding pieces are blocked by
   * it, knights jump over it but cannot land on it.
   */
  public setHole(row: number, col: number): void {
    this.holes.add(`${row},${col}`);
  }

  /** Remove a hole, restoring the square. */
  public clearHole(row: number, col: number): void {
    this.holes.delete(`${row},${col}`);
  }

  /**
   * Convert algebraic notation ("e4") into a grid coordinate.
   */
  public algebraicToGrid(square: string): Coordinate {
    return algebraicToGrid(square);
  }

  /**
   * Convert a grid coordinate into algebraic notation.
   */
  public gridToAlgebraic(row: number, col: number): string {
    return gridToAlgebraic(row, col);
  }
}

/** The shared instance used by the classic engine. */
export const phase1Grid = new BoardGrid10x10(true);
