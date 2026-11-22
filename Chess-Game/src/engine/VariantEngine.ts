/**
 * The Phase 2 variant layer over the standard engine.
 *
 * `chessops` knows nothing about card effects: holes, barriers or transformed
 * pieces are all foreign to a standard position. This module wraps it with
 * the extra rules and is the *only* place the card mechanics live. The
 * standard `StandardEngine` stays untouched, so a classic game runs
 * exactly as before and the variant layer is pure addition.
 *
 * The effect state (holes, transformed pieces, the active barrier) is what
 * the room stores in `boardState.gridConfig` / `variantState` — it does not
 * live in the FEN, so a game position can only be restored from the FEN and
 * this state together.
 */

import { Chess } from 'chessops/chess';
import { parseSquare } from 'chessops/util';
import { gridToSquare, squareToGrid, algebraicToGrid } from './grid/coords';
import { fenToPosition, positionToFen } from './grid/board';
import type { BarrierState, TransformedPiece } from '../types/room';

/** The card-effect state that lives outside the FEN. */
export interface VariantEffects {
  /** Destroyed squares, as "row,col" grid pairs. */
  holes: string[];
  /** Transformed pieces, keyed by algebraic square ("a1"). */
  transformed: Record<string, TransformedPiece>;
  /** The active Major Conflict box, when one is active. */
  barrier: BarrierState | null;
}

/** The empty effect state every game starts with. */
export function createEmptyVariantEffects(): VariantEffects {
  return { holes: [], transformed: {}, barrier: null };
}

/** A grid coordinate pair, as the effect state stores it. */
export type GridPair = [number, number];

/** The result of a pure effect application. */
export type EffectResult =
  | { ok: true; effects: VariantEffects; fen?: string }
  | { ok: false; reason: string };

const HOLES_PER_ABYSS = 3;

/** The two back ranks where pawns promote — holes may not land there. */
const PROMOTION_ROWS = [1, 8];

function keyOf(row: number, col: number): string {
  return `${row},${col}`;
}

/** The squares a rook/queen path from `from` to `to` crosses, exclusive of both. */
function pathSquares(from: [number, number], to: [number, number]): [number, number][] {
  const path: [number, number][] = [];
  const dr = Math.sign(to[0] - from[0]);
  const dc = Math.sign(to[1] - from[1]);
  if (from[0] !== to[0] && from[1] !== to[1]) return path; // not a straight line
  let r = from[0] + dr;
  let c = from[1] + dc;
  while (r !== to[0] || c !== to[1]) {
    path.push([r, c]);
    r += dr;
    c += dc;
  }
  return path;
}

/**
 * The variant engine.
 *
 * Owns the base position (FEN) and the effect state; answers filtered
 * legal-move queries and applies card effects as pure transformations that
 * the service layer writes back to the database.
 */
export class VariantEngine {
  private readonly pos: Chess;
  private readonly effects: VariantEffects;
  private readonly holeSet: Set<string>;

  constructor(fen: string, effects: VariantEffects = createEmptyVariantEffects()) {
    const parsed = fenToPosition(fen);
    if (!parsed) throw new Error(`Invalid FEN for variant engine: ${fen}`);
    this.pos = parsed;
    this.effects = effects;
    this.holeSet = new Set(effects.holes);
  }

  /** The effect state as passed to the constructor. */
  getEffects(): VariantEffects {
    return this.effects;
  }

  /** The base position, untouched by the effects. */
  getPosition(): Chess {
    return this.pos;
  }

  /**
   * Legal destinations of the piece on `square`, filtered by the card
   * effects: nothing may land on a hole or a locked square, sliding pieces
   * are blocked by holes as if a piece stood there, and the barrier traps
   * the pieces inside it.
   */
  getLegalMoves(square: string): string[] {
    const fromSq = parseSquare(square);
    if (fromSq === undefined) return [];

    const fromCoord = squareToGrid(fromSq);
    if (!fromCoord) return [];
    const from: GridPair = [fromCoord.row, fromCoord.col];

    const dests: string[] = [];
    for (const toSq of this.pos.dests(fromSq)) {
      const toCoord = squareToGrid(toSq);
      if (!toCoord) continue;
      const to: GridPair = [toCoord.row, toCoord.col];

      // Nothing lands on a hole.
      if (this.holeSet.has(keyOf(to[0], to[1]))) continue;

      // Sliding pieces: holes block the path like a piece would.
      const role = this.pos.board.get(fromSq)?.role;
      if (role === 'rook' || role === 'bishop' || role === 'queen') {
        const blocked = pathSquares(from, to).some(
          ([r, c]) => this.holeSet.has(keyOf(r, c)),
        );
        if (blocked) continue;
      }

      // The Major Conflict box traps every piece but the royal.
      if (this.effects.barrier) {
        if (this.isBarrierTrapMove(from, to)) continue;
      }

      dests.push(this.squareToString(toSq));
    }
    return dests;
  }

  /** Grid-coordinate version of {@link getLegalMoves}, for the board UI. */
  getLegalGridMoves(square: string): GridPair[] {
    return this.getLegalMoves(square).map((sq) => {
      const coord = algebraicToGrid(sq);
      return [coord.row, coord.col] as GridPair;
    });
  }

  /**
   * Apply The Abyss: turn up to three empty squares into holes.
   *
   * The squares must be empty, inside the active region, not on a
   * promotion rank, and the board must stay fully connected afterwards.
   */
  applyAbyss(targets: GridPair[]): EffectResult {
    if (targets.length !== HOLES_PER_ABYSS) {
      return { ok: false, reason: 'The Abyss destroys exactly three squares.' };
    }

    const nextHoles = new Set(this.holeSet);
    for (const [row, col] of targets) {
      const k = keyOf(row, col);
      if (this.holeSet.has(k)) {
        return { ok: false, reason: 'A chosen square is already a hole.' };
      }
      if (row < 1 || row > 8 || col < 1 || col > 8) {
        return { ok: false, reason: 'Holes must be on an active square.' };
      }
      if (this.pos.board.get(squareOf(row, col)) !== undefined) {
        return { ok: false, reason: 'Holes may only be placed on empty squares.' };
      }
      if (PROMOTION_ROWS.includes(row)) {
        return { ok: false, reason: 'No hole on a promotion rank.' };
      }
      nextHoles.add(k);
    }

    if (!this.boardStaysConnected(nextHoles)) {
      return { ok: false, reason: 'The Abyss must leave the board connected.' };
    }

    const effects: VariantEffects = {
      ...this.effects,
      holes: [...nextHoles],
    };
    return { ok: true, effects };
  }

  /**
   * Apply Small Reinforcements: summon one piece onto an empty square of
   * the summoner's home half. Returns the new FEN.
   */
  applyReinforcement(
    color: 'white' | 'black',
    target: GridPair,
    role: 'knight' | 'bishop',
  ): EffectResult {
    const [row, col] = target;
    if (row < 1 || row > 8 || col < 1 || col > 8) {
      return { ok: false, reason: 'Reinforcements must land on an active square.' };
    }
    if (!this.isHomeHalf(color, row)) {
      return { ok: false, reason: 'Reinforcements land on your own home half.' };
    }
    if (this.holeSet.has(keyOf(row, col))) {
      return { ok: false, reason: 'Reinforcements cannot land on a hole.' };
    }
    const sq = squareOf(row, col);
    if (this.pos.board.get(sq) !== undefined) {
      return { ok: false, reason: 'Reinforcements land on an empty square.' };
    }

    const board = this.pos.board;
    board.set(sq, { role, color });
    const nextPos = Chess.fromSetup(this.pos.toSetup());
    if (nextPos.isErr) {
      return { ok: false, reason: 'Reinforcement produced an invalid position.' };
    }
    return {
      ok: true,
      effects: this.effects,
      fen: positionToFen(nextPos.unwrap()),
    };
  }

  /**
   * Apply Redeployment: rearrange the six rook/knight/bishop slots of the
   * given side's back rank, leaving the king and queen in place. Prep-time
   * only — the back rank must still hold the untouched starting setup.
   */
  applyRedeployment(
    color: 'white' | 'black',
    arrangement: ('rook' | 'knight' | 'bishop')[],
  ): EffectResult {
    if (arrangement.length !== 6) {
      return { ok: false, reason: 'Redeployment rearranges exactly six pieces.' };
    }
    const multiset = arrangement.join(',').split(',').sort().join(',');
    const expected = ['bishop', 'bishop', 'knight', 'knight', 'rook', 'rook']
      .sort()
      .join(',');
    if (multiset !== expected) {
      return { ok: false, reason: 'Redeployment keeps the same six pieces.' };
    }

    const backRankRow = color === 'white' ? 8 : 1;
    const board = this.pos.board;

    // The back rank must still hold the untouched starting eight.
    for (let c = 1; c <= 8; c++) {
      const piece = board.get(squareOf(backRankRow, c));
      if (!piece || piece.color !== color) {
        return { ok: false, reason: 'Redeployment needs the untouched back rank.' };
      }
    }

    // King and queen stay on their starting files (e and d).
    const kingSq = squareOf(backRankRow, 5);
    const queenSq = squareOf(backRankRow, 4);
    const king = board.get(kingSq);
    const queen = board.get(queenSq);
    if (!king || king.role !== 'king' || !queen || queen.role !== 'queen') {
      return { ok: false, reason: 'Redeployment keeps the king and queen in place.' };
    }

    // The six slots, in file order a,b,c,f,g,h (d=queen, e=king).
    const slotCols = [1, 2, 3, 6, 7, 8];
    for (let i = 0; i < 6; i++) {
      const sq = squareOf(backRankRow, slotCols[i]);
      board.set(sq, { role: arrangement[i], color });
    }

    const nextPos = Chess.fromSetup(this.pos.toSetup());
    if (nextPos.isErr) {
      return { ok: false, reason: 'Redeployment produced an invalid position.' };
    }
    return {
      ok: true,
      effects: this.effects,
      fen: positionToFen(nextPos.unwrap()),
    };
  }

  // --- internals -----------------------------------------------------------

  /**
   * Whether a move is trapped by the barrier: a non-royal piece inside the
   * box cannot leave it. Pieces outside may enter; the royal is exempt.
   */
  private isBarrierTrapMove(from: GridPair, to: GridPair): boolean {
    const b = this.effects.barrier!;
    const fromIn = this.insideBox(from, b);
    const toIn = this.insideBox(to, b);
    if (!fromIn) return false; // entering the box is allowed
    if (!toIn) {
      // Leaving the box: allowed only for the royal piece.
      const fromSq = squareOf(from[0], from[1]);
      const role = this.pos.board.get(fromSq)?.role;
      return role !== 'king';
    }
    return false;
  }

  private insideBox(p: GridPair, b: BarrierState): boolean {
    const [row, col, size] = b.box;
    return p[0] >= row && p[0] < row + size && p[1] >= col && p[1] < col + size;
  }

  /**
   * Flood-fill over the active 8x8 squares minus the candidate holes.
   * Every surviving square must be reachable from any other.
   */
  private boardStaysConnected(candidateHoles: Set<string>): boolean {
    const playable: string[] = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 1; c <= 8; c++) {
        const k = keyOf(r, c);
        if (!candidateHoles.has(k)) playable.push(k);
      }
    }
    if (playable.length === 0) return true;

    const key = new Set(playable);
    const first = playable[0];
    const [fr, fc] = first.split(',').map(Number) as [number, number];
    const seen = new Set<string>([first]);
    const stack: [number, number][] = [[fr, fc]];
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nk = keyOf(r + dr, c + dc);
        if (key.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push([r + dr, c + dc]);
        }
      }
    }
    return seen.size === playable.length;
  }

  /** White's home half is ranks 1–4 (grid rows 5–8), black's ranks 5–8 (rows 1–4). */
  private isHomeHalf(color: 'white' | 'black', row: number): boolean {
    return color === 'white' ? row >= 5 : row <= 4;
  }

  private squareToString(sq: number): string {
    const file = String.fromCharCode(97 + (sq % 8));
    const rank = String((sq >> 3) + 1);
    return `${file}${rank}`;
  }
}

/** A "row,col" grid pair to a chessops square index, or 0 when out of range. */
function squareOf(row: number, col: number): number {
  const sq = gridToSquare(row, col);
  return sq === null ? 0 : sq;
}
