/**
 * Conversion between the game's 10x10 string-grid board and chessops' board
 * representation, plus the game-state mirror that chessops needs to reconstruct
 * castling rights, en-passant and the move counters.
 */

import { Chess } from 'chessops/chess';
import { Board } from 'chessops/board';
import { SquareSet } from 'chessops/squareSet';
import { parseFen, makeFen } from 'chessops/fen';
import type { Color, Role, Square } from 'chessops/types';
import type { Setup } from 'chessops/setup';
import { GRID_SIZE, gridToSquare, squareToGrid } from './coords';

/** The game's piece codes, e.g. 'wk', 'bq', 'wp'. */
export type PieceCode = string;

/**
 * The game's 10x10 board as stored in RTDB: a 10x10 array of piece codes,
 * empty string for an empty square. The classic 8x8 playfield lives at
 * rows 2..9, cols 0..7.
 */
export type GridBoard = string[][];

const ROLE_BY_CODE: Record<string, Role> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

/** The game's piece-code letter for each role. Note 'knight' is 'n', not 'k'. */
const CODE_BY_ROLE: Record<Role, string> = {
  king: 'k',
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  pawn: 'p',
};

/** Decode a game piece code ('wk') into chessops role + color. */
export function decodePiece(code: PieceCode): { role: Role; color: Color } | null {
  if (!code || code.length < 2) return null;
  const role = ROLE_BY_CODE[code[1]];
  if (!role) return null;
  const color: Color = code[0] === 'w' ? 'white' : 'black';
  return { role, color };
}

/** Encode role + color back into the game's piece code. */
export function encodePiece(role: Role, color: Color): PieceCode {
  return `${color === 'white' ? 'w' : 'b'}${CODE_BY_ROLE[role]}`;
}

/**
 * Convert the 10x10 grid board into a chessops Board.
 *
 * Only the classic 8x8 active region maps onto chessops' 64 squares; pieces
 * outside it (unlocked by cards) are ignored here and handled by the card
 * variant layer.
 */
export function gridToChessBoard(grid: GridBoard): Board {
  const board = Board.empty();
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const square = gridToSquare(row, col);
      if (square === null) continue;
      const decoded = decodePiece(grid[row]?.[col] ?? '');
      if (!decoded) continue;
      board.set(square, { role: decoded.role, color: decoded.color });
    }
  }
  return board;
}

/** Convert a chessops Board back into the 10x10 grid board. */
export function chessBoardToGrid(board: Board): GridBoard {
  const grid: GridBoard = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ''),
  );
  for (const [square, piece] of board) {
    const coord = squareToGrid(square);
    if (!coord) continue;
    grid[coord.row][coord.col] = encodePiece(piece.role, piece.color);
  }
  return grid;
}

/**
 * The pieces chessops needs beyond the board itself.
 *
 * The game's grid board carries no castling-rights or en-passant information,
 * so those must be tracked separately in the game state (see `GameState` in
 * services/gameSync.ts). This interface is that sidecar.
 */
export interface ChessStateExtras {
  /** Castling rights as a set of rook squares (chessops convention). */
  castlingRights?: SquareSet;
  /** En-passant target square, if any. */
  epSquare?: Square;
  /** Halfmove clock, for the 50-move rule. */
  halfmoves?: number;
  /** Fullmove number. */
  fullmoves?: number;
}

/**
 * Build a chessops Chess position from the grid board plus the sidecar state.
 * Returns null when the resulting position is not a legal chess position.
 */
export function buildPosition(
  grid: GridBoard,
  turn: Color,
  extras: ChessStateExtras = {},
): Chess | null {
  const board = gridToChessBoard(grid);
  const setup: Setup = {
    board,
    turn,
    castlingRights: extras.castlingRights ?? SquareSet.empty(),
    epSquare: extras.epSquare,
    pockets: undefined,
    remainingChecks: undefined,
    halfmoves: extras.halfmoves ?? 0,
    fullmoves: extras.fullmoves ?? 1,
  };
  const result = Chess.fromSetup(setup);
  if (result.isErr) return null;
  return result.value;
}

/** Serialise a chessops position to a FEN string. */
export function positionToFen(position: Chess): string {
  return makeFen(position.toSetup());
}

/** Parse a FEN string into a chessops Chess position, or null if invalid. */
export function fenToPosition(fen: string): Chess | null {
  const setup = parseFen(fen);
  if (setup.isErr) return null;
  const chess = Chess.fromSetup(setup.value);
  if (chess.isErr) return null;
  return chess.value;
}

/**
 * Derive the castling-rights square set from the board alone.
 *
 * This is only valid at the start of a game (or before the king or a rook has
 * moved); chessops' `Castles.fromSetup` derives the same thing from the setup,
 * but the game must persist rights across moves, so they are tracked in the
 * game state instead.
 */
export function deriveInitialCastlingRights(grid: GridBoard): SquareSet {
  let rights = SquareSet.empty();
  const board = gridToChessBoard(grid);
  for (const color of ['white', 'black'] as Color[]) {
    const king = board.kingOf(color);
    if (king === undefined) continue;
    const backrank = SquareSet.backrank(color);
    if (!backrank.has(king)) continue;
    const rooks = board.rook.intersect(board[color]).intersect(backrank);
    const aSide = rooks.first();
    if (aSide !== undefined && aSide < king) rights = rights.with(aSide);
    const hSide = rooks.last();
    if (hSide !== undefined && king < hSide) rights = rights.with(hSide);
  }
  return rights;
}
