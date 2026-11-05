/**
 * Chess engine facade for classic (card-free) mode.
 *
 * Wraps chessops so the rest of the app never imports it directly. The engine
 * works on the game's 10x10 grid board representation and exposes:
 *   - legal destination squares for a piece (for the move hints)
 *   - move application with full chess rules (check, castling, en passant,
 *     promotion) plus the resulting game outcome
 *   - SAN notation for the move list
 *
 * Card modes (Phase 2+) layer their own rules on top of this; see
 * `variant.ts` for the plan.
 */

import { Chess } from 'chessops/chess';
import { SquareSet } from 'chessops/squareSet';
import { makeSan } from 'chessops/san';
import type { Color, NormalMove, Role, Square } from 'chessops/types';
import { gridToSquare, squareToGrid } from './coords';
import {
  buildPosition,
  chessBoardToGrid,
  decodePiece,
  deriveInitialCastlingRights,
  encodePiece,
  positionToFen,
  type GridBoard,
} from './board';

export * from './coords';
export * from './board';
export * from './initialBoard';

/** A grid coordinate, matching the board component's expectations. */
export interface GridCoord {
  row: number;
  col: number;
}

/** The outcome of a position, in the game's own vocabulary. */
export type EngineOutcome =
  | { type: 'ongoing' }
  | { type: 'checkmate'; winner: Color }
  | { type: 'stalemate' }
  | { type: 'insufficientMaterial' }
  | { type: 'fiftyMoveRule' }
  | { type: 'threefoldRepetition' };

/** Result of attempting to apply a move. */
export type ApplyResult =
  | {
      ok: true;
      board: GridBoard;
      san: string;
      capturedPiece?: string;
      promotion?: Role;
      isCheck: boolean;
      isCheckmate: boolean;
      outcome: EngineOutcome;
      nextTurn: Color;
      /** Castling rights as rook square indices (0..63). */
      castlingRights: number[];
      epSquare?: number;
      halfmoves: number;
      fullmoves: number;
    }
  | { ok: false; reason: string };

/**
 * The sidecar state chessops needs that the grid board cannot express.
 * Persisted alongside the board in RTDB.
 */
export interface EngineState {
  board: GridBoard;
  turn: Color;
  /** Castling rights as rook square indices (chessops convention: 0..63). */
  castlingRights: number[];
  /** En-passant target square index. */
  epSquare?: number;
  halfmoves: number;
  fullmoves: number;
}

/** Create the starting state for a classic game. */
export function createInitialEngineState(board: GridBoard): EngineState {
  return {
    board,
    turn: 'white',
    castlingRights: [...deriveInitialCastlingRights(board)],
    epSquare: undefined,
    halfmoves: 0,
    fullmoves: 1,
  };
}

/** Rebuild a chessops position from the engine state. */
export function toPosition(state: EngineState): Chess | null {
  let rights = SquareSet.empty();
  for (const square of state.castlingRights) rights = rights.with(square as Square);
  return buildPosition(state.board, state.turn, {
    castlingRights: rights,
    epSquare: state.epSquare as Square | undefined,
    halfmoves: state.halfmoves,
    fullmoves: state.fullmoves,
  });
}

/**
 * Legal destination squares for the piece on a grid square.
 * Returns an empty array if the square holds no piece of the side to move.
 */
export function legalMovesFrom(state: EngineState, row: number, col: number): GridCoord[] {
  const position = toPosition(state);
  if (!position) return [];

  const from = gridToSquare(row, col);
  if (from === null) return [];

  const dests = position.dests(from);
  const result: GridCoord[] = [];
  for (const to of dests) {
    const coord = squareToGrid(to);
    if (coord) result.push(coord);
  }
  return result;
}

/** All legal moves from a square, as chessops normal moves (needed for promotion). */
export function allLegalMovesFrom(state: EngineState, row: number, col: number): NormalMove[] {
  const position = toPosition(state);
  if (!position) return [];

  const from = gridToSquare(row, col);
  if (from === null) return [];

  const moves: NormalMove[] = [];
  for (const to of position.dests(from)) {
    // Pawn reaching the last rank may promote to any of four pieces.
    if (position.board.pawn.has(from) && isBackRank(to, position.turn)) {
      for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as Role[]) {
        moves.push({ from, to, promotion });
      }
    } else {
      moves.push({ from, to });
    }
  }
  return moves;
}
function isBackRank(square: number, turn: Color): boolean {
  return turn === 'white' ? square >= 56 : square < 8;
}

/**
 * Apply a move to the engine state.
 *
 * The move is validated against the full ruleset (own king may not be left in
 * check, etc.), so this doubles as the server-side legality check.
 */
export function applyMove(
  state: EngineState,
  from: GridCoord,
  to: GridCoord,
  promotion?: Role,
): ApplyResult {
  const position = toPosition(state);
  if (!position) return { ok: false, reason: 'Invalid position' };

  const fromSquare = gridToSquare(from.row, from.col);
  const toSquare = gridToSquare(to.row, to.col);
  if (fromSquare === null) return { ok: false, reason: 'Source square is off the board' };
  if (toSquare === null) return { ok: false, reason: 'Destination square is off the board' };

  const piece = position.board.get(fromSquare);
  if (!piece) return { ok: false, reason: 'No piece on the source square' };
  if (piece.color !== state.turn) return { ok: false, reason: 'Not your piece' };

  const legal = allLegalMovesFrom(state, from.row, from.col);
  const match = legal.find(
    (m) => m.from === fromSquare && m.to === toSquare && (!('promotion' in m) || m.promotion === promotion),
  );
  if (!match) return { ok: false, reason: 'Illegal move' };

  const captured = position.board.get(toSquare);
  const san = makeSan(position, match);

  position.play(match);

  const isCheck = position.isCheck();
  // The 50-move counter must reflect the position *after* the move.
  const nextState: EngineState = { ...state, halfmoves: position.halfmoves };
  const outcome = evaluateOutcome(position, nextState);

  return {
    ok: true,
    board: chessBoardToGrid(position.board),
    san,
    capturedPiece: captured ? encodePiece(captured.role, captured.color) : undefined,
    promotion: 'promotion' in match ? match.promotion : undefined,
    isCheck,
    isCheckmate: outcome.type === 'checkmate',
    outcome,
    nextTurn: position.turn,
    castlingRights: [...position.castles.castlingRights],
    epSquare: position.epSquare,
    halfmoves: position.halfmoves,
    fullmoves: position.fullmoves,
  };
}

/**
 * Evaluate the terminal state of a position.
 *
 * chessops' `outcome()` covers checkmate, stalemate and insufficient material.
 * The 50-move and threefold repetition rules are layered on top: the halfmove
 * clock is tracked by chessops itself, while repetition is detected from the
 * move history (threefold repetition cannot be derived from a position alone).
 */
export function evaluateOutcome(
  position: Chess,
  state: EngineState,
  repetitionCount = 1,
): EngineOutcome {
  if (position.isCheckmate()) {
    return { type: 'checkmate', winner: position.turn === 'white' ? 'black' : 'white' };
  }
  if (position.isStalemate()) return { type: 'stalemate' };
  if (position.isInsufficientMaterial()) return { type: 'insufficientMaterial' };
  if (state.halfmoves >= 100) return { type: 'fiftyMoveRule' };
  if (repetitionCount >= 3) return { type: 'threefoldRepetition' };
  return { type: 'ongoing' };
}

/**
 * Evaluate the outcome of a state directly, without applying a move.
 * The server uses this after replaying the move list to decide whether the
 * game is over.
 */
export function evaluateStateOutcome(
  state: EngineState,
  repetitionCount = 1,
): EngineOutcome {
  const position = toPosition(state);
  if (!position) return { type: 'ongoing' };
  return evaluateOutcome(position, state, repetitionCount);
}

/** Serialise the engine state to FEN (for snapshots, debugging and PGN). */
export function stateToFen(state: EngineState): string | null {
  const position = toPosition(state);
  return position ? positionToFen(position) : null;
}

/**
 * Replay a list of moves from the initial state and return the final state.
 * This is the core of server-side validation: the server replays the recorded
 * moves and compares the resulting board with what the client claims.
 */
export interface RecordedMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  promotion?: string;
}

export function replayMoves(
  initial: EngineState,
  moves: RecordedMove[],
): { ok: true; state: EngineState; sans: string[] } | { ok: false; reason: string; index: number } {
  let state: EngineState = {
    board: initial.board.map((row) => [...row]),
    turn: initial.turn,
    castlingRights: [...initial.castlingRights],
    epSquare: initial.epSquare,
    halfmoves: initial.halfmoves,
    fullmoves: initial.fullmoves,
  };
  const sans: string[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const result = applyMove(
      state,
      { row: move.fromRow, col: move.fromCol },
      { row: move.toRow, col: move.toCol },
      move.promotion as Role | undefined,
    );
    if (!result.ok) {
      return { ok: false, reason: result.reason, index: i };
    }
    sans.push(result.san);
    state = {
      board: result.board,
      turn: result.nextTurn,
      castlingRights: result.castlingRights,
      epSquare: result.epSquare,
      halfmoves: result.halfmoves,
      fullmoves: result.fullmoves,
    };
  }

  return { ok: true, state, sans };
}

/**
 * Count how often the current position has occurred in the given move list.
 * Used for the threefold repetition rule.
 */
export function countRepetitions(initial: EngineState, moves: RecordedMove[]): number {
  let state: EngineState = {
    board: initial.board.map((row) => [...row]),
    turn: initial.turn,
    castlingRights: [...initial.castlingRights],
    epSquare: initial.epSquare,
    halfmoves: initial.halfmoves,
    fullmoves: initial.fullmoves,
  };

  const key = (s: EngineState) => {
    const position = toPosition(s);
    return position ? positionToFen(position).split(' ').slice(0, 4).join(' ') : '';
  };

  let count = 1;
  const current = key(state);

  for (const move of moves) {
    const result = applyMove(
      state,
      { row: move.fromRow, col: move.fromCol },
      { row: move.toRow, col: move.toCol },
      move.promotion as Role | undefined,
    );
    if (!result.ok) break;
    state = {
      board: result.board,
      turn: result.nextTurn,
      castlingRights: result.castlingRights,
      epSquare: result.epSquare,
      halfmoves: result.halfmoves,
      fullmoves: result.fullmoves,
    };
    if (key(state) === current) count++;
  }

  return count;
}

/** The piece code on a grid square, or empty string. */
export function pieceAt(board: GridBoard, row: number, col: number): string {
  return board[row]?.[col] ?? '';
}

/** Decode a piece code into a human-readable role name. */
export function roleName(code: string): Role | null {
  return decodePiece(code)?.role ?? null;
}
