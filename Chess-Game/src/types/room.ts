/**
 * The room schema, mirroring `docs/chess_system_architecture_document.md` §3.
 *
 * A room holds everything two players need for one game: metadata about the
 * match, the two players and their clocks, the board position, the move
 * history, and the empty card containers reserved for Phase 2.
 */

import {
  ACTIVE_MAX_COL,
  ACTIVE_MAX_ROW,
  ACTIVE_MIN_COL,
  ACTIVE_MIN_ROW,
} from '../engine/grid/constants';

/** The lifecycle of a room. */
export type RoomStatus = 'waiting' | 'prep_phase' | 'in_progress' | 'completed';

/** How a game ended. */
export type TerminationReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient_material'
  | 'fifty_move_rule'
  | 'threefold_repetition'
  | 'resignation'
  | 'timeout'
  | 'draw_agreement';

/** The winner of a finished room. */
export type RoomWinner = 'white' | 'black' | 'draw';

/** The game mode. Phase 2 adds the card modes. */
export type RoomMode = 'classic';

/** The clock settings of a room. */
export interface RoomTimeControl {
  /** The starting time on the clock, in milliseconds. */
  initialMs: number;
  /** The time added after each move, in milliseconds. */
  incrementMs: number;
}

/** Match-level information about a room. */
export interface RoomMetadata {
  /** When the room was created, in milliseconds since the epoch. */
  createdAt: number;
  /** When the room was last modified. */
  updatedAt: number;
  /** Where the room is in its lifecycle. */
  status: RoomStatus;
  /** The game mode. */
  mode: RoomMode;
  /** The winner, once the game is over. */
  winner: RoomWinner | null;
  /** Why the game ended. */
  terminationReason: TerminationReason | null;
  /** The clock settings. */
  timeControl: RoomTimeControl;
  /** The uid of the player who offered a draw, if any. */
  drawOfferedBy?: string | null;
}

/** One of the two players in a room. */
export interface RoomPlayer {
  /** The Firebase uid of the player. */
  uid: string;
  /** The display name shown in the HUD. */
  displayName: string;
  /** The player's avatar. */
  photoURL: string | null;
  /** The player's rating. */
  rank: number;
  /** The clock, in milliseconds remaining. */
  timeRemainingMs: number;
}

/** The two players, keyed by colour. */
export type RoomPlayers = {
  white: RoomPlayer | null;
  black: RoomPlayer | null;
};

/** A move as recorded in the room's history. */
export interface RoomMove {
  /** Source square in algebraic notation. */
  from: string;
  /** Destination square in algebraic notation. */
  to: string;
  /** The move in Standard Algebraic Notation. */
  san: string;
  /** Whether the move was a capture. */
  type: 'move' | 'capture';
  /** The promotion piece, when the move was a promotion. */
  promotion?: string;
  /** The uid of the player who made the move. */
  by: string;
  /** When the move was made. */
  timestamp: number;
}

/** The geometry of the active playfield, reserved for Phase 2 card effects. */
export interface GridConfig {
  /** First active row. */
  minRow: number;
  /** Last active row. */
  maxRow: number;
  /** First active column. */
  minCol: number;
  /** Last active column. */
  maxCol: number;
  /** The squares destroyed by card effects, as "row,col" pairs. */
  holes: string[];
}

/** Variant-specific state, reserved for Phase 2. */
export interface VariantState {
  /** The square holding each side's royal piece. */
  royalTag: { white: string | null; black: string | null };
  /** The positions of hidden pieces, keyed by piece id. */
  hiddenPieces: Record<string, { row: number; col: number }>;
  /** The active board restrictions, as "row,col" ranges. */
  activeBarriers: string[];
}

/** The board position of a room. */
export interface RoomBoardState {
  /** The position in FEN. */
  fen: string;
  /** The side to move. */
  turn: 'white' | 'black';
  /** The number of the full move in progress. */
  fullMoveNumber: number;
  /** Half-moves since the last capture or pawn move. */
  halfMoveClock: number;
  /** The move just played. */
  lastMove: RoomMove | null;
  /** True when the side to move is in check. */
  isCheck: boolean;
  /** True when the game has ended. */
  isGameOver: boolean;
  /** The active playfield geometry. */
  gridConfig: GridConfig;
  /** Variant state reserved for Phase 2. */
  variantState: VariantState;
}

/** One side's card state, reserved for Phase 2. */
export interface RoomCardSide {
  /** The card ids in the deck, at most three. */
  deck: string[];
  /** The card ids already used. */
  used: string[];
  /** The remaining cooldown of each card, in turns. */
  cooldowns: Record<string, number>;
}

/** The card containers of a room, reserved for Phase 2. */
export interface RoomCardState {
  white: RoomCardSide;
  black: RoomCardSide;
}

/** A complete room, as stored in RTDB under `/rooms/{roomId}`. */
export interface Room {
  metadata: RoomMetadata;
  players: RoomPlayers;
  boardState: RoomBoardState | null;
  cardState: RoomCardState;
  moveHistory: Record<string, RoomMove>;
}

/** A player's presence record, stored under `/presence/{uid}`. */
export interface PresenceRecord {
  /** Whether the player is online. */
  status: 'online' | 'offline';
  /** The room the player is currently in. */
  activeRoom: string | null;
  /** When the record was last written. */
  lastSeen: number;
}

/** The empty card state both sides start with. */
export function createEmptyCardState(): RoomCardState {
  return {
    white: { deck: [], used: [], cooldowns: {} },
    black: { deck: [], used: [], cooldowns: {} },
  };
}

/**
 * The Phase 1 grid configuration: the centred 8x8 block.
 *
 * The values come from the engine's own constants, so the stored geometry
 * can never drift away from the geometry the engine plays on.
 */
export function createPhase1GridConfig(): GridConfig {
  return {
    minRow: ACTIVE_MIN_ROW,
    maxRow: ACTIVE_MAX_ROW,
    minCol: ACTIVE_MIN_COL,
    maxCol: ACTIVE_MAX_COL,
    holes: [],
  };
}

/** The empty variant state both games start with. */
export function createEmptyVariantState(): VariantState {
  return { royalTag: { white: null, black: null }, hiddenPieces: {}, activeBarriers: [] };
}
