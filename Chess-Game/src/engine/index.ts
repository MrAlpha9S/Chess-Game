/**
 * The engine facade.
 *
 * Everything the app needs from the rules engine is re-exported here, so no
 * other module has to know whether the rules live in `core/` or `grid/`.
 *
 * The engine works on the game's 10x10 grid representation and exposes:
 *   - legal destination squares for a piece (for the move hints)
 *   - move application with the full chess ruleset (check, castling, en
 *     passant, promotion) plus the resulting outcome
 *   - SAN notation for the move list
 *
 * Card modes (Phase 2+) layer their own rules on top of this.
 */

import { StandardEngine, STARTING_FEN } from './core/StandardEngine';
import type {
  Color,
  GameOutcome,
  MoveRequest,
  MoveResult,
  PromotionPiece,
} from './core/IChessEngine';
import {
  chessBoardToGrid,
  createEmptyGridBoard,
  fenToPosition,
  positionToFen,
  type GridBoard,
} from './grid/board';
import { squareToGrid, type Coordinate } from './grid/coords';

export * from './core/IChessEngine';
export * from './core/StandardEngine';
export * from './grid/BoardGrid10x10';
export * from './grid/board';
export * from './grid/coords';
export * from './grid/constants';
export * from './grid/initialBoard';

/** A move as recorded in the room's move history. */
export interface RecordedMove {
  /** Source square in algebraic notation, e.g. "e2". */
  from: string;
  /** Destination square in algebraic notation, e.g. "e4". */
  to: string;
  /** Promotion piece, when the move was a promotion. */
  promotion?: PromotionPiece;
  /** The move in Standard Algebraic Notation. */
  san: string;
  /** The uid of the player who made the move. */
  by: string;
  /** When the move was made, in milliseconds since the epoch. */
  timestamp: number;
}

/**
 * The authoritative position of a game.
 *
 * The FEN carries the whole position — placement, side to move, castling
 * rights, the en-passant square and both move counters — so the room only
 * has to store it once.
 */
export interface GameState {
  /** The position in FEN. */
  fen: string;
  /** The side to move. */
  turn: Color;
  /** The number of the full move in progress, starting at 1. */
  fullMoveNumber: number;
  /** Half-moves since the last capture or pawn move, for the fifty-move rule. */
  halfMoveClock: number;
  /** The move just played. */
  lastMove?: RecordedMove;
  /** True when the side to move is in check. */
  isCheck: boolean;
  /** True when the game has ended. */
  isGameOver: boolean;
  /** How the game ended, when it has. */
  outcome: GameOutcome;
}

/** The state of a fresh game. */
export function createInitialGameState(): GameState {
  return {
    fen: STARTING_FEN,
    turn: 'white',
    fullMoveNumber: 1,
    halfMoveClock: 0,
    isCheck: false,
    isGameOver: false,
    outcome: 'ongoing',
  };
}

/**
 * Build a game state from a stored FEN, deriving the counters and the check
 * flag from the position itself.
 */
export function gameStateFromFen(fen: string): GameState {
  const position = fenToPosition(fen);
  if (!position) {
    return createInitialGameState();
  }
  const fields = fen.split(' ');
  const turn = fields[1] === 'black' ? 'black' : 'white';
  const halfmoves = Number(fields[4]) || 0;
  const fullmoves = Number(fields[5]) || 1;

  return {
    fen: positionToFen(position),
    turn,
    fullMoveNumber: fullmoves,
    halfMoveClock: halfmoves,
    isCheck: position.isCheck(),
    isGameOver: position.isEnd(),
    outcome: position.isEnd() ? classifyOutcome(position) : 'ongoing',
  };
}

/**
 * Classify how a finished position ended.
 */
function classifyOutcome(position: import('chessops/chess').Chess): GameOutcome {
  if (position.isCheckmate()) return 'checkmate';
  if (position.isStalemate()) return 'stalemate';
  if (position.isInsufficientMaterial()) return 'insufficientMaterial';
  if (position.halfmoves >= 100) return 'fiftyMoveRule';
  return 'ongoing';
}

/**
 * Apply a move to a game state and return the resulting state.
 *
 * The move is validated against the full ruleset — the side to move may not
 * leave its king in check — so this doubles as the legality check the client
 * performs before writing to the database.
 */
export function applyMoveToState(
  state: { fen: string },
  request: MoveRequest,
  by: string,
  timestamp: number,
): { ok: true; state: GameState; result: MoveResult } | { ok: false; reason: string } {
  const engine = new StandardEngine(state.fen);
  const result = engine.makeMove(request);
  if (!result.isValid) {
    return { ok: false, reason: result.errorReason ?? 'Illegal move' };
  }

  const nextFen = result.newFen;
  const nextTurn = result.nextTurn ?? 'white';
  const [, , , , halfmoves, fullmoves] = nextFen.split(' ');

  const move: RecordedMove = {
    from: request.from,
    to: request.to,
    promotion: request.promotion,
    san: result.san,
    by,
    timestamp,
  };

  const outcome: GameOutcome = result.isCheckmate
    ? 'checkmate'
    : result.isStalemate
      ? 'stalemate'
      : result.isInsufficientMaterial
        ? 'insufficientMaterial'
        : result.isFiftyMoveRule
          ? 'fiftyMoveRule'
          : 'ongoing';

  return {
    ok: true,
    result,
    state: {
      fen: nextFen,
      turn: nextTurn,
      fullMoveNumber: Number(fullmoves) || 1,
      halfMoveClock: Number(halfmoves) || 0,
      lastMove: move,
      isCheck: result.isCheck,
      isGameOver: outcome !== 'ongoing',
      outcome,
    },
  };
}

/**
 * Replay a move list from the starting position.
 *
 * This is the core of validation: replaying the recorded moves and comparing
 * the result with the stored position proves the history is consistent.
 */
export function replayMoves(
  initialFen: string,
  moves: RecordedMove[],
): { ok: true; state: GameState; sans: string[] } | { ok: false; reason: string; index: number } {
  let state = gameStateFromFen(initialFen);
  const sans: string[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const applied = applyMoveToState(
      state,
      { from: move.from, to: move.to, promotion: move.promotion as MoveRequest['promotion'] },
      move.by,
      move.timestamp,
    );
    if (!applied.ok) {
      return { ok: false, reason: applied.reason, index: i };
    }
    sans.push(applied.result.san);
    state = applied.state;
  }

  return { ok: true, state, sans };
}

/**
 * Count how often the current position has occurred in the move list.
 * Used for the threefold repetition rule.
 */
export function countRepetitions(initialFen: string, moves: RecordedMove[]): number {
  const positionKey = (fen: string): string => {
    const position = fenToPosition(fen);
    if (!position) return '';
    // The first four FEN fields identify the position for repetition
    // purposes: placement, side to move, castling rights and en-passant.
    return positionToFen(position).split(' ').slice(0, 4).join(' ');
  };

  const currentKey = positionKey(initialFen);
  let count = 1;
  let fen = initialFen;

  for (const move of moves) {
    const state = gameStateFromFen(fen);
    const applied = applyMoveToState(
      state,
      { from: move.from, to: move.to, promotion: move.promotion as MoveRequest['promotion'] },
      move.by,
      move.timestamp,
    );
    if (!applied.ok) break;
    fen = applied.state.fen;
    if (positionKey(fen) === currentKey) count++;
  }

  return count;
}

/**
 * Convert a FEN position into the 10x10 grid board the UI renders.
 *
 * An invalid FEN yields an empty board. This is the bridge between the
 * position stored in RTDB and the board the React component draws.
 */
export function fenToGrid(fen: string): GridBoard {
  const position = fenToPosition(fen);
  if (!position) return createEmptyGridBoard();
  return chessBoardToGrid(position.board);
}

/** A coordinate on the board grid. */
export type GridCoord = Coordinate;

/**
 * The grid coordinate of an algebraic square, or null when the square lies
 * outside the active region.
 */
export function squareToGridCoord(square: string): GridCoord | null {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  if (Number.isNaN(rank) || file < 0 || file > 7) return null;
  return squareToGrid((8 - rank) * 8 + file);
}
