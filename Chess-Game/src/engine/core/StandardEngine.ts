/**
 * The Phase 1 engine: standard chess rules backed by `chessops`.
 *
 * The engine owns a position in FEN, answers legal-move queries for the UI,
 * and applies moves. It deliberately knows nothing about Firebase: the
 * transport layer lives in `src/hooks/useGameSync.ts`.
 *
 * The 10x10 grid manager is consulted on every move so that Phase 2 cards can
 * lock squares or punch holes without touching the rule code.
 */

import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseSquare, makeSquare, parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { BoardGrid10x10 } from '../grid/BoardGrid10x10';
import { gridToSquare, squareToGrid } from '../grid/coords';
import type {
  Color,
  GameOutcome,
  IChessEngine,
  MoveRequest,
  MoveResult,
} from './IChessEngine';

/** The standard starting position. */
export const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Adapter over `chessops` implementing {@link IChessEngine}.
 */
export class StandardEngine implements IChessEngine {
  private pos!: Chess;
  private readonly gridManager: BoardGrid10x10;
  private outcome: GameOutcome = 'ongoing';

  constructor(fen?: string, gridManager?: BoardGrid10x10) {
    this.gridManager = gridManager ?? new BoardGrid10x10(true);
    this.init(fen);
  }

  public init(fen?: string): void {
    const parsed = parseFen(fen || STARTING_FEN);
    if (parsed.isErr) {
      throw new Error(`Invalid FEN: ${fen}`);
    }
    const chessRes = Chess.fromSetup(parsed.unwrap());
    if (chessRes.isErr) {
      throw new Error('Invalid chess setup from FEN');
    }
    this.pos = chessRes.unwrap();
    this.outcome = this.pos.isEnd() ? this.classifyEnd() : 'ongoing';
  }

  /** The grid manager, exposed so the card layer can adjust the board. */
  public getGrid(): BoardGrid10x10 {
    return this.gridManager;
  }

  public getLegalMoves(squareStr: string): string[] {
    const sq = parseSquare(squareStr);
    if (sq === undefined) return [];

    const dests: string[] = [];
    for (const to of this.pos.dests(sq)) {
      const destSquareStr = makeSquare(to);
      const coord = squareToGrid(to);
      if (!coord) continue;

      // Enforce the 10x10 grid boundaries.
      if (this.gridManager.isSquarePlayable(coord.row, coord.col)) {
        dests.push(destSquareStr);
      }
    }
    return dests;
  }

  /**
   * Legal destination squares expressed in grid coordinates, which is what
   * the board component renders.
   */
  public getLegalGridMoves(squareStr: string): { row: number; col: number }[] {
    return this.getLegalMoves(squareStr)
      .map((sq) => {
        const parsed = parseSquare(sq);
        return parsed === undefined ? null : squareToGrid(parsed);
      })
      .filter((c): c is { row: number; col: number } => c !== null);
  }

  public makeMove(request: MoveRequest): MoveResult {
    const fromSq = parseSquare(request.from);
    const toSq = parseSquare(request.to);
    if (fromSq === undefined || toSq === undefined) {
      return this.reject('Invalid square');
    }

    const fromCoord = squareToGrid(fromSq);
    const toCoord = squareToGrid(toSq);
    if (!fromCoord || !toCoord) {
      return this.reject('Square is outside the board');
    }
    if (!this.gridManager.isSquarePlayable(toCoord.row, toCoord.col)) {
      return this.reject('Destination square is not playable');
    }

    const uciString = `${request.from}${request.to}${request.promotion ?? ''}`;
    const move = parseUci(uciString);
    if (!move) {
      return this.reject('Invalid move representation');
    }

    // `isLegal` covers the cases where the destination is not literally one
    // of the pseudo-legal targets: castling is encoded as king-takes-rook,
    // and en passant targets a square no piece stands on.
    if (!this.pos.isLegal(move)) {
      return this.reject('Illegal move');
    }

    const captured = this.pos.board.get(toSq);
    const san = makeSan(this.pos, move);
    this.pos.play(move);

    const isCheck = this.pos.isCheck();
    const outcome = this.classifyEnd();
    this.outcome = outcome;

    return {
      isValid: true,
      newFen: makeFen(this.pos.toSetup()),
      san,
      isCheck,
      isCheckmate: outcome === 'checkmate',
      isStalemate: outcome === 'stalemate',
      isInsufficientMaterial: outcome === 'insufficientMaterial',
      isFiftyMoveRule: outcome === 'fiftyMoveRule',
      isThreefoldRepetition: false,
      capturedPiece: captured ? this.pieceCode(captured.role, captured.color) : undefined,
      nextTurn: this.pos.turn,
    };
  }

  public getFen(): string {
    return makeFen(this.pos.toSetup());
  }

  public getTurn(): Color {
    return this.pos.turn;
  }

  public isGameOver(): boolean {
    return this.pos.isEnd();
  }

  public getOutcome(): GameOutcome {
    return this.outcome;
  }

  /**
   * Classify how the current position ends. Threefold repetition cannot be
   * derived from a position alone, so it is detected from the move history by
   * the caller and reported separately.
   */
  private classifyEnd(): GameOutcome {
    if (this.pos.isCheckmate()) return 'checkmate';
    if (this.pos.isStalemate()) return 'stalemate';
    if (this.pos.isInsufficientMaterial()) return 'insufficientMaterial';
    if (this.pos.halfmoves >= 100) return 'fiftyMoveRule';
    return 'ongoing';
  }

  private reject(errorReason: string): MoveResult {
    return {
      isValid: false,
      newFen: this.getFen(),
      san: '',
      isCheck: this.pos.isCheck(),
      isCheckmate: false,
      isStalemate: false,
      isInsufficientMaterial: false,
      isFiftyMoveRule: false,
      isThreefoldRepetition: false,
      errorReason,
    };
  }

  private pieceCode(role: string, color: Color): string {
    const letter =
      role === 'knight'
        ? 'n'
        : role === 'king'
          ? 'k'
          : role === 'queen'
            ? 'q'
            : role === 'rook'
              ? 'r'
              : role === 'bishop'
                ? 'b'
                : 'p';
    return `${color === 'white' ? 'w' : 'b'}${letter}`;
  }
}

/**
 * Convert a grid coordinate to the chessops square index, re-exported so
 * callers outside the engine do not need to know the mapping internals.
 */
export { gridToSquare, squareToGrid };
