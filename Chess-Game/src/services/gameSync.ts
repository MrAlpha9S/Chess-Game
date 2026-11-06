import { ref, onValue, remove, update, type DatabaseReference } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { rtdb } from '../lib/firebase';
import { createInitialBoard, type GridBoard } from '@chess-game/chess-engine';

/**
 * Client-side access to the authoritative game state.
 *
 * The client never writes game state directly: moves go through the
 * `submitAction` Cloud Function, which validates them with the shared rules
 * engine before writing. The client reads the resulting state from
 * `matches/{matchId}/game` and uses the same engine locally to draw move
 * hints, so the two never disagree.
 */

// Types for game state
export interface GamePlayer {
  userId: string;
  displayName: string;
  photoURL: string | null;
  rank: number;
  color: 'white' | 'black';
  timeRemaining: number;
  capturedPieces: string[];
}

export interface GameMove {
  id: string;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  pieceType: string;
  color: string;
  capturedPieceType?: string;
  promotion?: string;
  san?: string;
  timestamp: number;
}

/** The authoritative game state, as written by the Cloud Functions. */
export interface GameState {
  board: GridBoard;
  currentTurn: 'white' | 'black';
  /** Castling rights as rook square indices (0..63). */
  castlingRights: number[];
  epSquare?: number;
  halfmoves: number;
  fullmoves: number;
  moves: StoredMove[];
  status: 'playing' | 'finished';
  winner?: 'white' | 'black' | 'draw';
  mode: 'classic' | 'card';
}

export interface StoredMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  promotion?: string;
  san: string;
  by: string;
  timestamp: number;
}

// Piece codes for board representation
export const PIECE_CODES = {
  white: { king: 'wk', queen: 'wq', rook: 'wr', bishop: 'wb', knight: 'wn', pawn: 'wp' },
  black: { king: 'bk', queen: 'bq', rook: 'br', bishop: 'bb', knight: 'bn', pawn: 'bp' },
};

/** Create the classic starting board. */
export function createInitialBoardFromEngine(): GridBoard {
  return createInitialBoard();
}

// Convert piece code to display
export function pieceCodeToDisplay(code: string): string {
  if (!code) return '';

  const pieces: Record<string, string> = {
    'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟',
  };

  return pieces[code] || '';
}

// Get piece color from code
export function getPieceColor(code: string): 'white' | 'black' | null {
  if (!code) return null;
  return code[0] === 'w' ? 'white' : 'black';
}

/** The result of submitting a move to the server. */
export interface SubmitMoveResult {
  ok: boolean;
  san?: string;
  capturedPiece?: string | null;
  isCheck?: boolean;
  isCheckmate?: boolean;
  outcome?: string;
  error?: string;
}

/**
 * Submit a move to the server for validation.
 *
 * The server replays the move history, validates the move against the rules
 * and only then writes the new state. A rejected move leaves the board
 * untouched, so the client simply keeps the previous position.
 */
export async function submitMove(
  matchId: string,
  from: { row: number; col: number },
  to: { row: number; col: number },
  promotion?: string,
): Promise<SubmitMoveResult> {
  const functions = getFunctions();
  const submitAction = httpsCallable<{
    matchId: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
    promotion?: string;
  }, SubmitMoveResult>(functions, 'submitAction');

  try {
    const result = await submitAction({ matchId, from, to, promotion });
    return result.data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not reach the server.';
    return { ok: false, error: message };
  }
}

/**
 * Ask the server to create the authoritative game state for a match.
 * Safe to call more than once: the server ignores the call if the game
 * already exists.
 */
export async function requestGameCreation(matchId: string): Promise<void> {
  const functions = getFunctions();
  const createGame = httpsCallable<{ matchId: string }, { ok: boolean }>(
    functions,
    'createGame',
  );
  await createGame({ matchId });
}

/**
 * Ask the server to record the game result.
 *
 * Result-determining writes are server-only (the rules block clients from
 * writing the game state), so this goes through the Cloud Function rather
 * than a direct RTDB write.
 */
export async function endGame(
  matchId: string,
  reason: 'resignation' | 'draw',
): Promise<SubmitMoveResult> {
  const functions = getFunctions();
  const resign = httpsCallable<
    { matchId: string; reason: string },
    { ok: boolean; winner?: 'white' | 'black' | 'draw'; reason?: string }
  >(functions, 'resign');
  try {
    const result = await resign({ matchId, reason });
    return { ...result.data, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the server.';
    return { ok: false, error: message };
  }
}

// Game Sync Service
class GameSyncService {
  private gameRef: DatabaseReference | null = null;
  private unsubscribeRef: (() => void) | null = null;

  // Debug ID
  private debugId: string = Math.random().toString(36).substring(2, 8);

  constructor() {
    console.log(`[GameSyncService ${this.debugId}] Created`);
  }

  /**
   * Subscribe to the authoritative game state.
   * The state is written by the Cloud Functions, not by the client.
   */
  subscribeToGame(matchId: string, callback: (game: GameState | null) => void): () => void {
    console.log(`[GameSyncService ${this.debugId}] subscribeToGame:`, matchId);

    if (this.gameRef) {
      this.unsubscribeRef?.();
    }

    this.gameRef = ref(rtdb, `matches/${matchId}/game`);

    this.unsubscribeRef = onValue(this.gameRef, (snapshot) => {
      const data = snapshot.val();
      console.log(`[GameSyncService ${this.debugId}] Game update:`, data?.status);
      callback(data as GameState | null);
    });

    return () => {
      this.unsubscribeRef?.();
      this.gameRef = null;
    };
  }

  /**
   * Make a move.
   *
   * The move is sent to the Cloud Function, which validates it and writes the
   * new state; this method does not touch the board itself.
   */
  async makeMove(
    matchId: string,
    _userId: string,
    move: {
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
      promotion?: string;
    },
  ): Promise<boolean> {
    const result = await submitMove(
      matchId,
      { row: move.fromRow, col: move.fromCol },
      { row: move.toRow, col: move.toCol },
      move.promotion,
    );

    if (!result.ok) {
      console.error(`[GameSyncService ${this.debugId}] Move rejected:`, result.error);
    }
    return result.ok;
  }

  // Update time remaining
  async updateTime(matchId: string, userId: string, timeRemaining: number): Promise<void> {
    await update(ref(rtdb, `matches/${matchId}/players/${userId}`), {
      timeRemaining,
    });
  }

  /**
   * End the game by resignation.
   *
   * The rules block clients from writing the result, so this asks the server
   * to record it.
   */
  async resign(matchId: string, userId: string): Promise<void> {
    console.log(`[GameSyncService ${this.debugId}] resign:`, { matchId, userId });

    const result = await endGame(matchId, 'resignation');
    if (!result.ok) {
      console.error(`[GameSyncService ${this.debugId}] resign failed:`, result.error);
    }
  }

  // Draw offer
  async offerDraw(matchId: string, userId: string): Promise<void> {
    await update(ref(rtdb, `matches/${matchId}/players/${userId}`), {
      offerDraw: true,
    });
  }

  // Accept draw
  async acceptDraw(matchId: string): Promise<void> {
    await endGame(matchId, 'draw');
  }

  // Get game state
  async getGame(matchId: string): Promise<GameState | null> {
    return new Promise((resolve) => {
      onValue(
        ref(rtdb, `matches/${matchId}/game`),
        (snapshot) => {
          resolve(snapshot.val() as GameState | null);
        },
        { onlyOnce: true },
      );
    });
  }

  // Delete game
  async deleteGame(matchId: string): Promise<void> {
    console.log(`[GameSyncService ${this.debugId}] deleteGame:`, matchId);
    await remove(ref(rtdb, `matches/${matchId}/game`));
  }

  // Clean up
  cleanup(): void {
    console.log(`[GameSyncService ${this.debugId}] cleanup`);
    this.unsubscribeRef?.();
    this.gameRef = null;
  }
}

export const gameSyncService = new GameSyncService();
