/**
 * The unified engine interface.
 *
 * The UI never talks to `chessops` directly: it talks to this interface, so
 * swapping the classic engine for a card variant later requires no change to
 * the React components.
 */

export type Color = 'white' | 'black';

/** The promotion piece a pawn may turn into. */
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

/** A request to move a piece, optionally promoting. */
export interface MoveRequest {
  /** Source square in algebraic notation, e.g. "e2". */
  from: string;
  /** Destination square in algebraic notation, e.g. "e4". */
  to: string;
  /** Promotion piece, required when a pawn reaches the last rank. */
  promotion?: PromotionPiece;
}

/** How a game ended. */
export type GameOutcome =
  | 'ongoing'
  | 'checkmate'
  | 'stalemate'
  | 'insufficientMaterial'
  | 'fiftyMoveRule'
  | 'threefoldRepetition';

/** The result of attempting a move. */
export interface MoveResult {
  /** False when the move was rejected; `errorReason` then explains why. */
  isValid: boolean;
  /** The position after the move, in FEN. Empty when the move was rejected. */
  newFen: string;
  /** The move in Standard Algebraic Notation. */
  san: string;
  /** True when the side to move is in check. */
  isCheck: boolean;
  /** True when the move delivers checkmate. */
  isCheckmate: boolean;
  /** True when the move leaves the side to move with no legal move. */
  isStalemate: boolean;
  /** True when the game ended by insufficient material. */
  isInsufficientMaterial: boolean;
  /** True when the game ended by the fifty-move rule. */
  isFiftyMoveRule: boolean;
  /** True when the game ended by threefold repetition. */
  isThreefoldRepetition: boolean;
  /** The piece code captured by the move, if any. */
  capturedPiece?: string;
  /** The side to move after the move. */
  nextTurn?: Color;
  /** Why the move was rejected. */
  errorReason?: string;
}

/**
 * The contract every engine — classic or variant — fulfils.
 */
export interface IChessEngine {
  /** Reset the engine to the given position, or the standard start. */
  init(fen?: string): void;
  /** Legal destination squares for the piece on the given square. */
  getLegalMoves(square: string): string[];
  /** Attempt a move. */
  makeMove(request: MoveRequest): MoveResult;
  /** The current position in FEN. */
  getFen(): string;
  /** The side to move. */
  getTurn(): Color;
  /** True when the game is over. */
  isGameOver(): boolean;
  /** How the game ended, if it has. */
  getOutcome(): GameOutcome;
}
