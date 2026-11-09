/**
 * Conversion between the 10x10 grid board and chessops' board representation.
 *
 * The game renders and stores the board as a 10x10 matrix of piece codes
 * ('wk', 'bp', …), with an empty string on an empty square. Only the active
 * 8x8 region maps onto chessops' 64 squares; squares outside it are ignored
 * by the converter and handled by the card variant layer.
 */

import { Chess } from 'chessops/chess';
import { Board } from 'chessops/board';
import { SquareSet } from 'chessops/squareSet';
import { parseFen, makeFen } from 'chessops/fen';
import type { Color, Role, Square } from 'chessops/types';
import type { Setup } from 'chessops/setup';
import { GRID_SIZE } from './constants';
import { gridToSquare, squareToGrid } from './coords';

/** A piece code such as 'wk' or 'bp'. */
export type PieceCode = string;

/**
 * The board as stored in RTDB and rendered by the UI: a 10x10 array of piece
 * codes, empty string for an empty square.
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

/** The piece-code letter for each role. Note 'knight' is 'n', not 'k'. */
const CODE_BY_ROLE: Record<Role, string> = {
  king: 'k',
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  pawn: 'p',
};

/** Decode a piece code ('wk') into a chessops role and colour. */
export function decodePiece(code: PieceCode): { role: Role; color: Color } | null {
  if (!code || code.length < 2) return null;
  const role = ROLE_BY_CODE[code[1]];
  if (!role) return null;
  const color: Color = code[0] === 'w' ? 'white' : 'black';
  return { role, color };
}

/** Encode a role and colour back into the game's piece code. */
export function encodePiece(role: Role, color: Color): PieceCode {
  return `${color === 'white' ? 'w' : 'b'}${CODE_BY_ROLE[role]}`;
}

/** An empty 10x10 grid board. */
export function createEmptyGridBoard(): GridBoard {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ''),
  );
}

/** Convert the 10x10 grid board into a chessops Board. */
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
  const grid = createEmptyGridBoard();
  for (const [square, piece] of board) {
    const coord = squareToGrid(square);
    if (!coord) continue;
    grid[coord.row][coord.col] = encodePiece(piece.role, piece.color);
  }
  return grid;
}

/**
 * The pieces chessops needs beyond the board itself. The grid board carries
 * no castling-rights or en-passant information, so those are tracked as
 * sidecar state.
 */
export interface ChessStateExtras {
  /** Castling rights as a set of rook squares (chessops convention). */
  castlingRights?: SquareSet;
  /** En-passant target square, if any. */
  epSquare?: Square;
  /** Halfmove clock, for the fifty-move rule. */
  halfmoves?: number;
  /** Fullmove number. */
  fullmoves?: number;
}

/**
 * Build a chessops position from the grid board plus the sidecar state.
 * Returns null when the result is not a legal chess position.
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
  return result.unwrap();
}

/** Serialise a chessops position to a FEN string. */
export function positionToFen(position: Chess): string {
  return makeFen(position.toSetup());
}

/** Parse a FEN string into a chessops position, or null if invalid. */
export function fenToPosition(fen: string): Chess | null {
  const setup = parseFen(fen);
  if (setup.isErr) return null;
  const chess = Chess.fromSetup(setup.unwrap());
  if (chess.isErr) return null;
  return chess.unwrap();
}

/**
 * Derive the castling-rights square set from the board alone.
 *
 * Only valid at the start of a game (or before the king or a rook has moved);
 * chessops derives the same thing from the setup, but the game persists
 * rights across moves, so they are tracked as state instead.
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
