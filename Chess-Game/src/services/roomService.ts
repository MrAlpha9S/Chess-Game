/**
 * Room access for the client-first architecture.
 *
 * The client owns the rules: it validates a move locally with the shared
 * engine, then writes the resulting position to Realtime Database. The
 * database rules are the backstop that rejects out-of-turn writes, so a
 * tampered client cannot take a turn that is not its own.
 *
 * Every write goes through `update()` on a multi-path patch so the position,
 * the move history and the metadata change together.
 */

import { ref, set, get, update, remove, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import {
  applyMoveToState,
  createInitialGameState,
  gameStateFromFen,
  type GameOutcome,
  type MoveRequest,
} from '../engine';
import {
  createEmptyCardState,
  createEmptyVariantState,
  createPhase1GridConfig,
  type Room,
  type RoomMove,
  type RoomPlayer,
  type RoomTimeControl,
  type TerminationReason,
} from '../types/room';

/** Convert the engine's outcome names to the RTDB room schema. */
function toTerminationReason(outcome: Exclude<GameOutcome, 'ongoing'>): TerminationReason {
  switch (outcome) {
    case 'insufficientMaterial':
      return 'insufficient_material';
    case 'fiftyMoveRule':
      return 'fifty_move_rule';
    case 'threefoldRepetition':
      return 'threefold_repetition';
    default:
      return outcome;
  }
}

/** The identity of a player joining a room. */
export interface RoomPlayerIdentity {
  uid: string;
  displayName: string;
  photoURL: string | null;
  rank: number;
}

/** The clock settings a room is created with. */
export const DEFAULT_TIME_CONTROL: RoomTimeControl = {
  initialMs: 10 * 60 * 1000,
  incrementMs: 0,
};

/** The characters used in a room code. Ambiguous ones are left out. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** How long a waiting room survives before it is cleaned up. */
const ROOM_TTL_MS = 10 * 60 * 1000;

/** Generate a six-character room code. */
function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET.charAt(Math.floor(Math.random() * ROOM_CODE_ALPHABET.length));
  }
  return code;
}

/**
 * The room service.
 *
 * Every method is a thin, typed wrapper over the Realtime Database SDK.
 */
class RoomService {
  private roomRef(roomId: string) {
    return ref(rtdb, `rooms/${roomId}`);
  }

  /**
   * Create a waiting room with the creator as the white player.
   *
   * The room code is unique across the database; a collision is retried.
   */
  async createRoom(
    player: RoomPlayerIdentity,
    timeControl: RoomTimeControl = DEFAULT_TIME_CONTROL,
  ): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const roomId = generateRoomCode();
      const snapshot = await get(this.roomRef(roomId));
      if (snapshot.exists()) continue;

      const now = Date.now();
      const room: Room = {
        metadata: {
          createdAt: now,
          updatedAt: now,
          status: 'waiting',
          mode: 'classic',
          winner: null,
          terminationReason: null,
          timeControl,
        },
        players: {
          white: {
            uid: player.uid,
            displayName: player.displayName,
            photoURL: player.photoURL,
            rank: player.rank,
            timeRemainingMs: timeControl.initialMs,
          },
          black: null,
        },
        boardState: null,
        cardState: createEmptyCardState(),
        moveHistory: {},
      };

      await set(this.roomRef(roomId), room);
      await this.scheduleRoomExpiry(roomId);
      return roomId;
    }

    throw new Error('Could not allocate a unique room code.');
  }

  /** Delete a waiting room that nobody joined. */
  private async scheduleRoomExpiry(roomId: string): Promise<void> {
    setTimeout(() => {
      void (async () => {
        const snapshot = await get(this.roomRef(roomId));
        const room = snapshot.val() as Room | null;
        if (room?.metadata.status === 'waiting') {
          await remove(this.roomRef(roomId));
        }
      })();
    }, ROOM_TTL_MS);
  }

  /**
   * Join a waiting room as the black player.
   *
   * The database rules only allow writing an empty black slot, so two players
   * cannot claim the same seat.
   */
  async joinRoom(roomId: string, player: RoomPlayerIdentity): Promise<void> {
    const snapshot = await get(this.roomRef(roomId));
    const room = snapshot.val() as Room | null;

    if (!room) {
      throw new Error('This room does not exist.');
    }
    if (room.metadata.status !== 'waiting') {
      throw new Error('This room is no longer accepting players.');
    }
    if (room.players.black) {
      throw new Error('This room is already full.');
    }
    if (room.players.white?.uid === player.uid) {
      throw new Error('You cannot join your own room.');
    }

    const black: RoomPlayer = {
      uid: player.uid,
      displayName: player.displayName,
      photoURL: player.photoURL,
      rank: player.rank,
      timeRemainingMs: room.metadata.timeControl.initialMs,
    };

    // Only claim the empty black seat here. Updating metadata in the same
    // patch would be rejected by the rules: while evaluating
    // `metadata/updatedAt`, the existing room still has no black player, so
    // Firebase cannot identify the joining user as a room member yet.
    await update(this.roomRef(roomId), {
      'players/black': black,
    });
  }

  /** Read a room once. */
  async getRoom(roomId: string): Promise<Room | null> {
    const snapshot = await get(this.roomRef(roomId));
    return (snapshot.val() as Room | null) ?? null;
  }

  /** Subscribe to a room. Returns the unsubscribe function. */
  subscribeToRoom(roomId: string, callback: (room: Room | null) => void): () => void {
    return onValue(this.roomRef(roomId), (snapshot) => {
      callback((snapshot.val() as Room | null) ?? null);
    });
  }

  /**
   * Start the game: both seats are taken and the board is initialised.
   *
   * Only the host may start the game; the rules reject the write otherwise.
   */
  async startGame(roomId: string, hostUid: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('This room does not exist.');
    if (room.players.white?.uid !== hostUid) {
      throw new Error('Only the host can start the game.');
    }
    if (!room.players.black) {
      throw new Error('The room needs two players to start.');
    }

    const game = createInitialGameState();
    await update(this.roomRef(roomId), {
      boardState: {
        ...game,
        lastMove: null,
        gridConfig: createPhase1GridConfig(),
        variantState: createEmptyVariantState(),
      },
      'metadata/status': 'in_progress',
      'metadata/updatedAt': Date.now(),
    });
  }

  /**
   * Play a move.
   *
   * The move is validated against the rules by the shared engine before
   * anything is written. The write itself is a single atomic patch covering
   * the new position and the appended history entry, and the database rules
   * additionally require that the writer owns the side to move.
   */
  async playMove(
    roomId: string,
    playerUid: string,
    request: MoveRequest,
    clockMs?: number,
  ): Promise<RoomMove> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('This room does not exist.');
    if (!room.boardState) throw new Error('The game has not started yet.');
    if (room.metadata.status !== 'in_progress') {
      throw new Error('This game is already over.');
    }

    const color = this.getPlayerColor(room, playerUid);
    if (!color) throw new Error('You are not a player in this room.');
    if (room.boardState.turn !== color) {
      throw new Error('It is not your turn.');
    }

    const applied = applyMoveToState(room.boardState, request, playerUid, Date.now());
    if (!applied.ok) {
      throw new Error(applied.reason);
    }

    // Realtime Database strips empty objects: a freshly created room has no
    // `moveHistory` key until the first move is written, so it is read with
    // a fallback.
    const moveNumber = Object.keys(room.moveHistory ?? {}).length;
    const move: RoomMove = {
      from: request.from,
      to: request.to,
      san: applied.result.san,
      type: applied.result.capturedPiece ? 'capture' : 'move',
      by: playerUid,
      timestamp: Date.now(),
      // Realtime Database rejects `undefined` anywhere in the payload, so
      // the promotion piece is only present when the move actually has one.
      ...(request.promotion ? { promotion: request.promotion } : {}),
    };

    const patch: Record<string, unknown> = {
      boardState: {
        ...applied.state,
        lastMove: move,
        // RTDB omits empty arrays/objects when reading. Reconstruct the
        // Phase 1 containers instead of echoing possibly-undefined fields
        // from the read-back room.
        gridConfig: {
          minRow: room.boardState.gridConfig?.minRow ?? createPhase1GridConfig().minRow,
          maxRow: room.boardState.gridConfig?.maxRow ?? createPhase1GridConfig().maxRow,
          minCol: room.boardState.gridConfig?.minCol ?? createPhase1GridConfig().minCol,
          maxCol: room.boardState.gridConfig?.maxCol ?? createPhase1GridConfig().maxCol,
          holes: room.boardState.gridConfig?.holes ?? [],
        },
        variantState: {
          royalTag: {
            white: room.boardState.variantState?.royalTag?.white ?? null,
            black: room.boardState.variantState?.royalTag?.black ?? null,
          },
          hiddenPieces: room.boardState.variantState?.hiddenPieces ?? {},
          activeBarriers: room.boardState.variantState?.activeBarriers ?? [],
        },
      },
      [`moveHistory/${moveNumber}`]: move,
      'metadata/updatedAt': Date.now(),
      ...(applied.state.outcome !== 'ongoing'
        ? {
            'metadata/status': 'completed',
            'metadata/winner':
              applied.state.outcome === 'checkmate' ? color : 'draw',
            'metadata/terminationReason': toTerminationReason(applied.state.outcome),
          }
        : {}),
    };

    // The clock is written in the same patch, so the time the player had left
    // when they moved and the increment land together.
    if (clockMs !== undefined) {
      const increment = room.metadata.timeControl.incrementMs ?? 0;
      const next = Math.max(0, Math.round(clockMs)) + increment;
      patch[`players/${color}/timeRemainingMs`] = next;
    }

    await update(this.roomRef(roomId), patch);

    return move;
  }

  /**
   * Concede the game. The opponent wins.
   */
  async resign(roomId: string, playerUid: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('This room does not exist.');

    const color = this.getPlayerColor(room, playerUid);
    if (!color) throw new Error('You are not a player in this room.');

    const winner = color === 'white' ? 'black' : 'white';
    await this.finish(roomId, winner, 'resignation');
  }

  /** Offer a draw to the opponent. */
  async offerDraw(roomId: string, playerUid: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('This room does not exist.');
    if (!this.getPlayerColor(room, playerUid)) {
      throw new Error('You are not a player in this room.');
    }

    await update(this.roomRef(roomId), {
      'metadata/drawOfferedBy': playerUid,
      'metadata/updatedAt': Date.now(),
    });
  }

  /** Accept a draw offer and end the game. */
  async acceptDraw(roomId: string, playerUid: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('This room does not exist.');
    if (!this.getPlayerColor(room, playerUid)) {
      throw new Error('You are not a player in this room.');
    }

    await this.finish(roomId, 'draw', 'draw_agreement');
  }

  /**
   * End the game with the given outcome.
   *
   * The UI reads the result from `metadata.status`, so no board state write
   * is needed here. The board rules would reject it anyway: they require
   * the turn to flip, and finishing the game leaves the turn unchanged.
   */
  private async finish(
    roomId: string,
    winner: 'white' | 'black' | 'draw',
    reason: TerminationReason,
  ): Promise<void> {
    await update(this.roomRef(roomId), {
      'metadata/status': 'completed',
      'metadata/winner': winner,
      'metadata/terminationReason': reason,
      'metadata/updatedAt': Date.now(),
    });
  }

  /**
   * End the game because a player ran out of time.
   */
  async flagTimeout(roomId: string, loserUid: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('This room does not exist.');

    const color = this.getPlayerColor(room, loserUid);
    if (!color) throw new Error('You are not a player in this room.');

    const winner = color === 'white' ? 'black' : 'white';
    await this.finish(roomId, winner, 'timeout');
  }

  /**
   * Store a player's remaining time.
   *
   * The rules only let a player write their own clock, so neither side can
   * freeze the other's time.
   */
  async updateClock(roomId: string, color: 'white' | 'black', timeRemainingMs: number): Promise<void> {
    await update(this.roomRef(roomId), {
      [`players/${color}/timeRemainingMs`]: Math.max(0, Math.round(timeRemainingMs)),
    });
  }

  /** Remove a room entirely. */
  async deleteRoom(roomId: string): Promise<void> {
    await remove(this.roomRef(roomId));
  }

  /**
   * Record the player's presence and clean it up when they disconnect.
   */
  async setPresence(uid: string, activeRoom: string | null): Promise<void> {
    const presenceRef = ref(rtdb, `presence/${uid}`);
    await set(presenceRef, { status: 'online', activeRoom, lastSeen: Date.now() });
    await onDisconnect(presenceRef).set({ status: 'offline', activeRoom: null, lastSeen: Date.now() });
  }

  /** Clear the player's presence record. */
  async clearPresence(uid: string): Promise<void> {
    await remove(ref(rtdb, `presence/${uid}`));
  }

  /** The colour a player sits on, or null when they are not in the room. */
  getPlayerColor(room: Room, uid: string): 'white' | 'black' | null {
    if (room.players.white?.uid === uid) return 'white';
    if (room.players.black?.uid === uid) return 'black';
    return null;
  }

  /** Rebuild the game state of a room from its stored position. */
  toGameState(room: Room) {
    if (!room.boardState) return null;
    return gameStateFromFen(room.boardState.fen);
  }
}

export const roomService = new RoomService();
