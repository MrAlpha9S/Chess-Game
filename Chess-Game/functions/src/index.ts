/**
 * Cloud Functions for the chess game.
 *
 * The client is never trusted: every move goes through `submitAction`, which
 * validates it with the shared game service and only then writes the new
 * state.
 *
 * The validation logic itself lives in `@chess-game/game-service`, shared
 * with the standalone Express API in `server/`. Both front ends enforce
 * exactly the same rules, so there is one source of truth.
 *
 * Authoritative game state lives under `matches/{matchId}/game`. Clients may
 * read it, but only the Admin SDK (i.e. these functions) may write it - see
 * `database.rules.json`.
 *
 * Note: deploying these functions requires the Blaze plan. If you are on the
 * free Spark plan, deploy the Express API in `server/` instead - it needs no
 * billing account.
 */

import { initializeApp } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { GameError, GameService } from '@chess-game/game-service';
import type { GameStorage } from '@chess-game/game-service';
import type { StoredGame, StoredMove, StoredPlayer } from '@chess-game/game-service';

initializeApp();

const db: Database = getDatabase();

/** Realtime Database storage for the game service. */
class RtdbStorage implements GameStorage {
  private gamePath(matchId: string): string {
    return `matches/${matchId}/game`;
  }

  async readGame(matchId: string): Promise<StoredGame | null> {
    const snapshot = await db.ref(this.gamePath(matchId)).get();
    return (snapshot.val() as StoredGame | null) ?? null;
  }

  async writeGame(matchId: string, game: StoredGame): Promise<void> {
    await db.ref(this.gamePath(matchId)).set(game);
  }

  async patchGame(matchId: string, patch: Partial<StoredGame>): Promise<void> {
    await db.ref(this.gamePath(matchId)).update(patch);
  }

  async readPlayers(matchId: string): Promise<StoredPlayer[]> {
    const snapshot = await db.ref(`matches/${matchId}/players`).get();
    const value = snapshot.val() as
      | StoredPlayer[]
      | Record<string, StoredPlayer>
      | null;
    if (!value) return [];
    return Array.isArray(value) ? value : Object.values(value);
  }

  async patchMatch(matchId: string, patch: Record<string, unknown>): Promise<void> {
    await db.ref(`matches/${matchId}`).update(patch);
  }
}

const service = new GameService(new RtdbStorage());

/** Translate a GameError into the callable error the client expects. */
function toHttpsError(error: unknown): never {
  if (error instanceof GameError) {
    throw new HttpsError(error.code, error.message);
  }
  throw error;
}

/**
 * Create the authoritative game state for a match.
 * Exported separately from the callable wrapper so it can be tested directly.
 */
export async function createGameHandler(request: CallableRequest) {
  try {
    return await service.createGame(request.data?.matchId as string);
  } catch (error) {
    toHttpsError(error);
  }
}

export const createGame = onCall(createGameHandler);

/**
 * Submit a move. The server replays the recorded move list through the rules
 * engine, then validates the submitted move against the resulting position.
 * Only then is the new state written.
 *
 * Exported separately from the callable wrapper so it can be tested directly.
 */
export async function submitActionHandler(request: CallableRequest) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to play.');

  const body = request.data as {
    matchId?: string;
    from?: { row: number; col: number };
    to?: { row: number; col: number };
    promotion?: string;
  };

  try {
    return await service.submitMove({
      matchId: body.matchId as string,
      uid,
      from: body.from as { row: number; col: number },
      to: body.to as { row: number; col: number },
      promotion: body.promotion,
    });
  } catch (error) {
    toHttpsError(error);
  }
}

export const submitAction = onCall(submitActionHandler);

/**
 * End the game by resignation or agreed draw.
 *
 * Result-determining writes are server-only: the rules block clients from
 * writing `status`/`winner`, so the client asks this function instead.
 */
export async function resignHandler(request: CallableRequest) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to play.');

  const body = request.data as { matchId?: string; reason?: string };
  const reason = body.reason === 'draw' ? 'draw' : 'resignation';

  try {
    return await service.endGame(body.matchId as string, uid, reason);
  } catch (error) {
    toHttpsError(error);
  }
}

export const resign = onCall(resignHandler);

export type { StoredMove };
