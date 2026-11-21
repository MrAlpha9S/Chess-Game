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

/**
 * The image path for a piece.
 *
 * The sprite files are named by full kind ("king.png", not "k.png"), matching
 * what `scripts/generate-pieces.mjs` writes, so the single-letter piece code
 * is resolved through `pieceKind` before building the path.
 */
export function pieceImage(piece: PieceCode): string {
  const color: PieceColor = piece[0] === 'w' ? 'white' : 'black';
  const kind = pieceKind(piece);
  if (!kind) return '';
  return `/assets/pieces/${color}/${kind}.png`;
}

/**
 * The image path for a piece transformed by a Phase 2 card.
 *
 * The card catalog names the sprite file (e.g. "the-tower"); the path
 * resolves through the colour folder just like a normal piece. Returns the
 * ordinary piece image when the card has no transformed sprite.
 */
export function transformedPieceImage(color: PieceColor, sprite: string): string {
  return `/assets/pieces/${color}/${sprite}.png`;
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
