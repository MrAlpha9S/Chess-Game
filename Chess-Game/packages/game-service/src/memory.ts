/**
 * An in-memory GameStorage, used by the tests.
 *
 * It mirrors the read/patch semantics of a flat document store: `readGame`
 * returns a deep copy so callers can't mutate the stored state, and `patch`
 * merges one level deep, like a shallow RTDB update.
 */

import type { GameStorage } from './storage';
import type { StoredGame, StoredPlayer } from './types';

export class InMemoryGameStorage implements GameStorage {
  readonly games = new Map<string, StoredGame>();
  readonly players = new Map<string, StoredPlayer[]>();
  readonly matches = new Map<string, Record<string, unknown>>();

  readGame(matchId: string): Promise<StoredGame | null> {
    const game = this.games.get(matchId);
    return Promise.resolve(game ? structuredClone(game) : null);
  }

  writeGame(matchId: string, game: StoredGame): Promise<void> {
    this.games.set(matchId, structuredClone(game));
    return Promise.resolve();
  }

  patchGame(matchId: string, patch: Partial<StoredGame>): Promise<void> {
    const current = this.games.get(matchId) ?? ({} as StoredGame);
    this.games.set(matchId, { ...current, ...structuredClone(patch) });
    return Promise.resolve();
  }

  readPlayers(matchId: string): Promise<StoredPlayer[]> {
    return Promise.resolve(
      structuredClone(this.players.get(matchId) ?? []),
    );
  }

  patchMatch(matchId: string, patch: Record<string, unknown>): Promise<void> {
    const current = this.matches.get(matchId) ?? {};
    this.matches.set(matchId, { ...current, ...patch });
    return Promise.resolve();
  }

  /** Test helper: seed a player list for a match. */
  seedPlayers(matchId: string, players: StoredPlayer[]): void {
    this.players.set(matchId, structuredClone(players));
  }
}
