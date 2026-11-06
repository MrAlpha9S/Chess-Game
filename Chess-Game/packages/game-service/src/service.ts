/**
 * The game rules service.
 *
 * Every mutation to the authoritative game state goes through here. The
 * service never trusts the client: it replays the recorded move list through
 * the shared rules engine, checks that the stored position is the one the
 * history actually reaches, and only then applies and writes the new state.
 *
 * The service is transport-agnostic: it takes a `GameStorage` and a caller
 * identity, and returns a plain result object. The Express API and the
 * Cloud Functions both sit on top of it.
 */

import {
  applyMove,
  createInitialBoard,
  createInitialEngineState,
  countRepetitions,
  evaluateStateOutcome,
  type EngineState,
  type GridBoard,
  type RecordedMove,
} from '@chess-game/chess-engine';
import type { GameStorage } from './storage';
import type { PlayerColor, StoredGame, StoredMove } from './types';

/** A failed request. The `code` is stable and safe to show to clients. */
export type GameErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'not-found'
  | 'failed-precondition'
  | 'aborted';

export class GameError extends Error {
  code: GameErrorCode;
  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

export interface SubmitMoveInput {
  matchId: string;
  uid: string;
  from: { row: number; col: number };
  to: { row: number; col: number };
  promotion?: string;
}

export interface SubmitMoveResult {
  ok: true;
  san: string;
  capturedPiece: string | null;
  isCheck: boolean;
  isCheckmate: boolean;
  outcome: string;
  board: GridBoard;
  currentTurn: PlayerColor;
}

export interface CreateGameResult {
  ok: true;
  alreadyExisted: boolean;
}

export interface EndGameResult {
  ok: true;
  winner: PlayerColor | 'draw';
  reason: string;
}

export class GameService {
  private readonly storage: GameStorage;

  constructor(storage: GameStorage) {
    this.storage = storage;
  }

  /**
   * Initialise the authoritative game state for a match.
   * Safe to call more than once: an existing game is left untouched.
   */
  async createGame(matchId: string): Promise<CreateGameResult> {
    if (!matchId) throw new GameError('invalid-argument', 'matchId is required');

    const existing = await this.storage.readGame(matchId);
    if (existing) return { ok: true, alreadyExisted: true };

    const board = createInitialBoard();
    const state: StoredGame = {
      board,
      currentTurn: 'white',
      castlingRights: createInitialEngineState(board).castlingRights,
      epSquare: undefined,
      halfmoves: 0,
      fullmoves: 1,
      moves: [],
      status: 'playing',
      mode: 'classic',
    };

    await this.storage.writeGame(matchId, state);
    return { ok: true, alreadyExisted: false };
  }

  /**
   * Submit a move.
   *
   * The move is validated against the full ruleset and against the recorded
   * history; only a legal move from the player whose turn it is is accepted.
   */
  async submitMove(input: SubmitMoveInput): Promise<SubmitMoveResult> {
    const { matchId, uid, from, to, promotion } = input;
    if (!matchId) throw new GameError('invalid-argument', 'matchId is required');
    if (!from || !to) throw new GameError('invalid-argument', 'from and to are required');

    const game = await this.storage.readGame(matchId);
    if (!game) throw new GameError('not-found', 'Game not found.');
    if (game.status === 'finished') {
      throw new GameError('failed-precondition', 'Game already finished.');
    }

    // Replay the recorded moves from the starting position and confirm the
    // result matches the stored board. A client that wrote a position it
    // could not legally reach is rejected here.
    const replayed = replayHistory(game.moves);
    if (!replayed.ok) {
      throw new GameError(
        'failed-precondition',
        `Stored game state is inconsistent: ${replayed.reason}`,
      );
    }
    if (!boardsEqual(replayed.state.board, game.board)) {
      throw new GameError(
        'failed-precondition',
        'Stored game state is inconsistent with its move history.',
      );
    }
    if (replayed.state.turn !== game.currentTurn) {
      throw new GameError(
        'failed-precondition',
        'Stored turn does not match the move history.',
      );
    }

    // The validated position, rebuilt from the history rather than trusted.
    const state = replayed.state;

    // Whose turn is it? Reject moves out of turn.
    const playerColor = await this.resolveColor(matchId, uid);
    if (playerColor !== state.turn) {
      throw new GameError('failed-precondition', 'It is not your turn.');
    }

    const result = applyMove(
      state,
      { row: from.row, col: from.col },
      { row: to.row, col: to.col },
      promotion as 'queen' | 'rook' | 'bishop' | 'knight' | undefined,
    );
    if (!result.ok) {
      throw new GameError('failed-precondition', `Illegal move: ${result.reason}`);
    }

    // Count repetitions for the threefold rule, then evaluate the resulting
    // position (checkmate, stalemate, insufficient material, 50-move rule).
    const repetition = countRepetitions(state, game.moves as RecordedMove[]);
    const nextState: EngineState = {
      board: result.board,
      turn: result.nextTurn,
      castlingRights: result.castlingRights,
      epSquare: result.epSquare,
      halfmoves: result.halfmoves,
      fullmoves: result.fullmoves,
    };
    const outcome = evaluateStateOutcome(nextState, repetition);

    const move: StoredMove = {
      fromRow: from.row,
      fromCol: from.col,
      toRow: to.row,
      toCol: to.col,
      promotion: result.promotion,
      san: result.san,
      by: uid,
      timestamp: Date.now(),
    };

    const next: StoredGame = {
      ...game,
      board: result.board,
      currentTurn: result.nextTurn,
      castlingRights: result.castlingRights,
      epSquare: result.epSquare,
      halfmoves: result.halfmoves,
      fullmoves: result.fullmoves,
      moves: [...game.moves, move],
      status: outcome.type === 'ongoing' ? 'playing' : 'finished',
      winner: winnerOf(outcome),
    };

    // Write only if the game is still at the same version we validated, so
    // two concurrent moves cannot overwrite each other.
    const current = await this.storage.readGame(matchId);
    if (!current || current.moves.length !== game.moves.length) {
      throw new GameError('aborted', 'The game state changed. Please retry.');
    }

    await this.storage.writeGame(matchId, next);

    return {
      ok: true,
      san: result.san,
      capturedPiece: result.capturedPiece ?? null,
      isCheck: result.isCheck,
      isCheckmate: result.isCheckmate,
      outcome: outcome.type,
      board: result.board,
      currentTurn: result.nextTurn,
    };
  }

  /**
   * End the game by resignation or agreed draw.
   *
   * Result-determining writes are server-only: the security rules block
   * clients from writing the result, so the client asks the server instead.
   */
  async endGame(
    matchId: string,
    uid: string,
    reason: 'resignation' | 'draw',
  ): Promise<EndGameResult> {
    if (!matchId) throw new GameError('invalid-argument', 'matchId is required');

    const color = await this.resolveColor(matchId, uid);
    const winner: PlayerColor | 'draw' =
      reason === 'draw' ? 'draw' : color === 'white' ? 'black' : 'white';

    // The game state, if it exists.
    const game = await this.storage.readGame(matchId);
    if (game && game.status === 'playing') {
      await this.storage.patchGame(matchId, { status: 'finished', winner });
    }

    // The match metadata that the UI reacts to.
    await this.storage.patchMatch(matchId, { status: 'finished', winner });

    return { ok: true, winner, reason };
  }

  /** Determine the colour a player has in a match. */
  private async resolveColor(matchId: string, uid: string): Promise<PlayerColor | null> {
    const players = await this.storage.readPlayers(matchId);
    return players.find((p) => p?.userId === uid)?.color ?? null;
  }
}

/**
 * Replay the recorded moves from the starting position.
 *
 * The result is the position the history actually reaches. Comparing it with
 * the stored board detects a client that wrote a position it could not
 * legally reach.
 */
export function replayHistory(
  moves: StoredMove[],
): { ok: true; state: EngineState } | { ok: false; reason: string } {
  const board = createInitialBoard();
  let state: EngineState = {
    board,
    turn: 'white',
    castlingRights: createInitialEngineState(board).castlingRights,
    epSquare: undefined,
    halfmoves: 0,
    fullmoves: 1,
  };

  for (const move of moves) {
    const result = applyMove(
      state,
      { row: move.fromRow, col: move.fromCol },
      { row: move.toRow, col: move.toCol },
      move.promotion as 'queen' | 'rook' | 'bishop' | 'knight' | undefined,
    );
    if (!result.ok) return { ok: false, reason: `move ${move.san}: ${result.reason}` };
    state = {
      board: result.board,
      turn: result.nextTurn,
      castlingRights: result.castlingRights,
      epSquare: result.epSquare,
      halfmoves: result.halfmoves,
      fullmoves: result.fullmoves,
    };
  }

  return { ok: true, state };
}

/** Compare two 10x10 boards cell by cell. */
export function boardsEqual(left: GridBoard, right: GridBoard): boolean {
  if (left.length !== right.length) return false;
  for (let row = 0; row < left.length; row++) {
    const leftRow = left[row] ?? [];
    const rightRow = right[row] ?? [];
    if (leftRow.length !== rightRow.length) return false;
    for (let col = 0; col < leftRow.length; col++) {
      if (leftRow[col] !== rightRow[col]) return false;
    }
  }
  return true;
}

function winnerOf(outcome: {
  type: string;
  winner?: PlayerColor;
}): PlayerColor | 'draw' | undefined {
  if (outcome.type === 'checkmate') return outcome.winner;
  if (outcome.type === 'ongoing') return undefined;
  return 'draw';
}
