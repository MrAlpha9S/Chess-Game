/**
 * Realtime Database storage for the game state.
 *
 * The server authenticates with a service account, so it bypasses the client
 * security rules: it is the only writer of the authoritative game state.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import type { GameStorage } from '@chess-game/game-service';
import type { StoredGame, StoredPlayer } from '@chess-game/game-service';
import type { Config } from './config';

export function initDatabase(config: Config): Database {
  if (getApps().length === 0) {
    const credential = config.serviceAccount?.client_email
      ? cert({
          projectId: config.serviceAccount.project_id ?? config.projectId,
          clientEmail: config.serviceAccount.client_email,
          privateKey: config.serviceAccount.private_key?.replace(/\\n/g, '\n'),
        })
      : undefined;
    initializeApp({ credential, databaseURL: config.databaseURL });
  }
  return getDatabase();
}

/** A GameStorage backed by Realtime Database. */
export class RtdbGameStorage implements GameStorage {
  constructor(private readonly db: Database) {}

  private gamePath(matchId: string): string {
    return `matches/${matchId}/game`;
  }

  async readGame(matchId: string): Promise<StoredGame | null> {
    const snapshot = await this.db.ref(this.gamePath(matchId)).get();
    return (snapshot.val() as StoredGame | null) ?? null;
  }

  async writeGame(matchId: string, game: StoredGame): Promise<void> {
    await this.db.ref(this.gamePath(matchId)).set(game);
  }

  async patchGame(matchId: string, patch: Partial<StoredGame>): Promise<void> {
    await this.db.ref(this.gamePath(matchId)).update(patch);
  }

  async readPlayers(matchId: string): Promise<StoredPlayer[]> {
    const snapshot = await this.db.ref(`matches/${matchId}/players`).get();
    const value = snapshot.val() as
      | StoredPlayer[]
      | Record<string, StoredPlayer>
      | null;
    if (!value) return [];
    return Array.isArray(value) ? value : Object.values(value);
  }

  async patchMatch(matchId: string, patch: Record<string, unknown>): Promise<void> {
    await this.db.ref(`matches/${matchId}`).update(patch);
  }
}
