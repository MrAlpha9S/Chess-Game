/**
 * How a piece code maps to a sprite.
 *
 * A piece code is a colour letter followed by a kind letter, for example 'wk'
 * for the white king and 'bp' for a black pawn.
 */

/** The piece kinds the game knows about. */
export type PieceKind = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

/** A piece code as stored in the database. */
export type PieceCode = string;

/** The colour of a piece. */
export type PieceColor = 'white' | 'black';

/** The image path for a piece. */
export function pieceImage(piece: PieceCode): string {
  const color: PieceColor = piece[0] === 'w' ? 'white' : 'black';
  const kind = piece[1];
  return `/assets/pieces/${color}/${kind}.png`;
}

/** The kind of a piece, without its colour. */
export function pieceKind(piece: PieceCode): PieceKind | null {
  switch (piece[1]) {
    case 'k': return 'king';
    case 'q': return 'queen';
    case 'r': return 'rook';
    case 'b': return 'bishop';
    case 'n': return 'knight';
    case 'p': return 'pawn';
    default: return null;
  }
}
