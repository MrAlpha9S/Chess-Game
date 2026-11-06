/**
 * Shared game state types.
 *
 * These mirror the shape of the data stored in Realtime Database, so the
 * storage layer can read and write it without translation.
 */

import type { GridBoard } from '@chess-game/chess-engine';

export type PlayerColor = 'white' | 'black';
export type GameStatus = 'playing' | 'finished';
export type GameMode = 'classic' | 'card';

/** A single recorded move, as stored in the move list. */
export interface StoredMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  promotion?: string;
  /** Standard algebraic notation, e.g. "Nf3", "exd5", "O-O". */
  san: string;
  /** The uid of the player who made the move. */
  by: string;
  timestamp: number;
}

/** The authoritative game state, stored under `matches/{matchId}/game`. */
export interface StoredGame {
  board: GridBoard;
  currentTurn: PlayerColor;
  /** Castling rights as rook square indices (0..63). */
  castlingRights: number[];
  epSquare?: number;
  halfmoves: number;
  fullmoves: number;
  moves: StoredMove[];
  status: GameStatus;
  winner?: PlayerColor | 'draw';
  mode: GameMode;
}

/** A player entry as stored under `matches/{matchId}/players`. */
export interface StoredPlayer {
  userId: string;
  displayName: string;
  photoURL: string | null;
  rank: number;
  color: PlayerColor;
  ready?: boolean;
  timeout?: boolean;
  offerDraw?: boolean;
  timeRemaining?: number;
}
