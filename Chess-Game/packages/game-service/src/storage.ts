/**
 * Storage interface for the authoritative game state.
 *
 * The validation logic does not know about Firebase: it reads and writes
 * through this interface, so the same code can be exercised in tests with an
 * in-memory implementation and run in production against Realtime Database.
 */

import type { StoredGame, StoredPlayer } from './types';

export interface GameStorage {
  /** Read the game state, or null when the match has no game yet. */
  readGame(matchId: string): Promise<StoredGame | null>;
  /** Write the whole game state. */
  writeGame(matchId: string, game: StoredGame): Promise<void>;
  /** Patch a few fields of the game state. */
  patchGame(matchId: string, patch: Partial<StoredGame>): Promise<void>;
  /** Read the player list of a match. */
  readPlayers(matchId: string): Promise<StoredPlayer[]>;
  /** Patch a few fields of the match metadata. */
  patchMatch(matchId: string, patch: Record<string, unknown>): Promise<void>;
}
