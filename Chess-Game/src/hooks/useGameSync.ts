/**
 * Bridge between the room in Realtime Database and the React UI.
 *
 * The hook subscribes to `/rooms/{roomId}` and exposes the room, the derived
 * board and the actions a player may take. Moves are validated by the shared
 * engine inside `roomService` before they are written, and the database
 * rules reject any write that does not come from the side to move.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roomService, type RoomPlayerIdentity } from '../services/roomService';
import {
  fenToGrid,
  gridToAlgebraic,
  StandardEngine,
  type GridCoord,
  type MoveRequest,
} from '../engine';
import type { Room } from '../types/room';

/** The snapshot the UI renders from. */
export interface GameSnapshot {
  /** The room as stored in the database. */
  room: Room | null;
  /** The board as the 10x10 grid of piece codes. */
  board: string[][];
  /** The colour the current user sits on. */
  myColor: 'white' | 'black' | null;
  /** The other player's profile. */
  opponent: { uid: string; displayName: string; photoURL: string | null; rank: number } | null;
  /** True when it is the current user's turn. */
  isMyTurn: boolean;
  /** True when the game has ended. */
  isGameOver: boolean;
  /** The last error raised by an action. */
  error: string | null;
}

/** The actions the UI may trigger. */
export interface GameActions {
  /** Play a move. */
  playMove: (request: MoveRequest, clockMs?: number) => Promise<boolean>;
  /** Concede the game. */
  resign: () => Promise<boolean>;
  /** Offer a draw. */
  offerDraw: () => Promise<boolean>;
  /** Accept the opponent's draw offer. */
  acceptDraw: () => Promise<boolean>;
  /** Store the remaining time on the clock. */
  syncClock: (timeRemainingMs: number) => Promise<void>;
  /** Clear the current error. */
  clearError: () => void;
}

/**
 * Subscribe to a room and expose its state and the actions available on it.
 */
export function useGameSync(roomId: string, currentUser: RoomPlayerIdentity | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Which room has delivered its first snapshot. Deriving `loaded` from this
  // avoids resetting state inside the subscription effect.
  const [loadedRoomId, setLoadedRoomId] = useState<string | null>(null);
  const loaded = loadedRoomId === roomId;

  // Subscribe to the room.
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = roomService.subscribeToRoom(roomId, (updated) => {
      if (!mountedRef.current) return;
      setRoom(updated);
      setLoadedRoomId(roomId);
    });

    return () => {
      unsubscribe();
    };
  }, [roomId]);

  const myColor = useMemo(() => {
    if (!room || !currentUser) return null;
    return roomService.getPlayerColor(room, currentUser.uid);
  }, [room, currentUser]);

  const opponent = useMemo(() => {
    if (!room || !currentUser) return null;
    const other = room.players.white?.uid === currentUser.uid ? room.players.black : room.players.white;
    if (!other) return null;
    return {
      uid: other.uid,
      displayName: other.displayName,
      photoURL: other.photoURL,
      rank: other.rank,
    };
  }, [room, currentUser]);

  const board = useMemo(() => {
    const boardState = room?.boardState;
    if (!boardState) return [];
    return fenToGrid(boardState.fen);
  }, [room?.boardState]);

  const playMove = useCallback(
    async (request: MoveRequest, clockMs?: number): Promise<boolean> => {
      if (!roomId || !currentUser) return false;
      setError(null);
      try {
        await roomService.playMove(roomId, currentUser.uid, request, clockMs);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The move was rejected.';
        if (mountedRef.current) setError(message);
        return false;
      }
    },
    [roomId, currentUser],
  );

  const resign = useCallback(async (): Promise<boolean> => {
    if (!roomId || !currentUser) return false;
    setError(null);
    try {
      await roomService.resign(roomId, currentUser.uid);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resign.';
      if (mountedRef.current) setError(message);
      return false;
    }
  }, [roomId, currentUser]);

  const offerDraw = useCallback(async (): Promise<boolean> => {
    if (!roomId || !currentUser) return false;
    setError(null);
    try {
      await roomService.offerDraw(roomId, currentUser.uid);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not offer a draw.';
      if (mountedRef.current) setError(message);
      return false;
    }
  }, [roomId, currentUser]);

  const acceptDraw = useCallback(async (): Promise<boolean> => {
    if (!roomId || !currentUser) return false;
    setError(null);
    try {
      await roomService.acceptDraw(roomId, currentUser.uid);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not accept the draw.';
      if (mountedRef.current) setError(message);
      return false;
    }
  }, [roomId, currentUser]);

  const syncClock = useCallback(
    async (timeRemainingMs: number): Promise<void> => {
      if (!roomId || !myColor) return;
      try {
        await roomService.updateClock(roomId, myColor, timeRemainingMs);
      } catch {
        // A dropped clock write is not worth interrupting the game for; the
        // next write carries the corrected value.
      }
    },
    [roomId, myColor],
  );

  const clearError = useCallback(() => setError(null), []);

  const snapshot: GameSnapshot = {
    room,
    board,
    myColor,
    opponent,
    isMyTurn: room?.boardState?.turn === myColor && room?.metadata.status === 'in_progress',
    isGameOver: room?.metadata.status === 'completed',
    error,
  };

  const actions: GameActions = {
    playMove,
    resign,
    offerDraw,
    acceptDraw,
    syncClock,
    clearError,
  };

  return { ...snapshot, loaded, actions };
}

/**
 * The grid coordinates a piece may legally move to.
 */
export function useLegalMoves(fen: string | undefined, from: GridCoord | null): GridCoord[] {
  return useMemo(() => {
    if (!fen || !from) return [];
    const engine = new StandardEngine(fen);
    const algebraic = gridToAlgebraic(from.row, from.col);
    return engine.getLegalGridMoves(algebraic);
  }, [fen, from]);
}
