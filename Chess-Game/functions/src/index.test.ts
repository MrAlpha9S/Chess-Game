/**
 * Tests for the Cloud Function game logic.
 *
 * These run against a mocked `firebase-admin` database so the validation
 * behaviour - not the Firebase transport - is what is exercised. The engine
 * under test is the same shared code the client uses, which is the point of
 * the "one rule engine" design.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

// --- Mock firebase-admin before importing the module under test ------------

type DbValue = Record<string, unknown> | null;
type GetFn = () => Promise<{ val: () => DbValue }>;
type SetFn = (val: DbValue) => Promise<void>;

interface MockRef {
  get: GetFn;
  set: SetFn;
  /** All the values that have been written to this ref, in order. */
  writes: DbValue[];
}

const mockRefs: Record<string, MockRef> = {};

function refFor(path: string): MockRef {
  if (!mockRefs[path]) {
    let stored: DbValue = null;
    const writes: DbValue[] = [];
    mockRefs[path] = {
      get: async () => ({ val: () => structuredClone(stored) as DbValue }),
      set: async (val) => {
        stored = val;
        writes.push(structuredClone(val));
      },
      writes,
    };
  }
  return mockRefs[path];
}

vi.mock('firebase-admin/app', () => ({
  initializeApp: () => ({}),
}));

vi.mock('firebase-admin/database', () => ({
  getDatabase: () => ({
    ref: (path: string) => refFor(path),
  }),
}));

// Import after the mocks are in place. The raw handlers are exported
// separately from the `onCall` wrappers so they can be invoked directly.
const { submitActionHandler, createGameHandler } = await import('./index');

/**
 * Build a request object for the callable handlers. The platform fills in
 * many more fields, but the handlers only read `auth.uid` and `data`.
 */
function request(data: unknown, uid = 'server'): CallableRequest {
  return { auth: { uid }, data } as unknown as CallableRequest;
}

// --- Helpers ----------------------------------------------------------------

interface GameData {
  board: string[][];
  currentTurn: 'white' | 'black';
  castlingRights: number[];
  halfmoves: number;
  fullmoves: number;
  moves: Record<string, unknown>[];
  status: 'playing' | 'finished';
  mode: 'classic' | 'card';
  winner?: 'white' | 'black' | 'draw';
}

/** Seed the mocks so `createGame` produces a fresh board and the players
 * are recorded for `resolveColor`. */
async function seedMatch(
  matchId: string,
  players: Record<string, { userId: string; color: 'white' | 'black' }>,
): Promise<void> {
  const createResult = await createGameHandler(request({ matchId }));
  expect(createResult).toMatchObject({ ok: true, alreadyExisted: false });
  refFor(`matches/${matchId}/players`).set(players);
}

function gameRef(matchId: string) {
  return mockRefs[`matches/${matchId}/game`]!;
}

async function submit(
  matchId: string,
  uid: string,
  from: { row: number; col: number },
  to: { row: number; col: number },
): Promise<unknown> {
  return submitActionHandler(request({ matchId, from, to }, uid));
}

async function lastGame(matchId: string): Promise<GameData> {
  const writes = gameRef(matchId).writes;
  return structuredClone(writes[writes.length - 1]) as unknown as GameData;
}

// --- Tests -------------------------------------------------------------------

beforeEach(() => {
  // Each test starts from an empty database.
  for (const key of Object.keys(mockRefs)) delete mockRefs[key];
});

describe('createGame', () => {
  it('writes the starting position', async () => {
    await seedMatch('m1', {});
    const game = await lastGame('m1');
    expect(game.currentTurn).toBe('white');
    expect(game.moves).toEqual([]);
    expect(game.status).toBe('playing');
    // Black back rank on row 2.
    expect(game.board[2]).toEqual(['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br', '', '']);
    // White back rank on row 9.
    expect(game.board[9]).toEqual(['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', '', '']);
  });

  it('is idempotent when called again', async () => {
    await seedMatch('m1', {});
    await createGameHandler(request({ matchId: 'm1' }));
    // The second call is a no-op: the game already exists, so nothing is written.
    const writes = gameRef('m1').writes;
    expect(writes).toHaveLength(1);
  });
});

describe('submitAction', () => {
  it('applies a legal move and records it in SAN', async () => {
    await seedMatch('m2', {
      alice: { userId: 'alice', color: 'white' },
      bob: { userId: 'bob', color: 'black' },
    });

    // 1. e4 (row 8 col 4 -> row 6 col 4)
    const result = await submit('m2', 'alice', { row: 8, col: 4 }, { row: 6, col: 4 });
    expect(result).toMatchObject({ ok: true, san: 'e4', currentTurn: 'black' });

    const game = await lastGame('m2');
    expect(game.moves).toHaveLength(1);
    expect(game.moves[0]).toMatchObject({ san: 'e4', by: 'alice' });
  });

  it('rejects an illegal move and leaves the board unchanged', async () => {
    await seedMatch('m3', {
      alice: { userId: 'alice', color: 'white' },
      bob: { userId: 'bob', color: 'black' },
    });

    // The b1 knight cannot jump to a3 in one move to a diagonal square c2.
    let threw = false;
    try {
      await submit('m3', 'alice', { row: 9, col: 1 }, { row: 7, col: 1 });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    const game = await lastGame('m3');
    // No move was ever written.
    expect(game.moves).toHaveLength(0);
    expect(game.board[9]).toEqual(['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', '', '']);
  });

  it('rejects moving when it is not your turn', async () => {
    await seedMatch('m4', {
      alice: { userId: 'alice', color: 'white' },
      bob: { userId: 'bob', color: 'black' },
    });

    // Alice plays e4, making it Bob's turn.
    await submit('m4', 'alice', { row: 8, col: 4 }, { row: 6, col: 4 });

    let threw = false;
    try {
      // Alice tries to play again out of turn.
      await submit('m4', 'alice', { row: 8, col: 3 }, { row: 6, col: 3 });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('rejects a board that does not match the move history', async () => {
    await seedMatch('m5', {
      alice: { userId: 'alice', color: 'white' },
      bob: { userId: 'bob', color: 'black' },
    });

    // Legally play e4, then tamper with the stored board.
    await submit('m5', 'alice', { row: 8, col: 4 }, { row: 6, col: 4 });
    const tampered = await lastGame('m5');
    tampered.board[5][0] = 'wp'; // a pawn teleporting to a5 - unreachable
    gameRef('m5').set(tampered as unknown as Record<string, unknown>);

    let threw = false;
    try {
      await submit('m5', 'bob', { row: 3, col: 4 }, { row: 5, col: 4 });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('finishes the game on checkmate', async () => {
    await seedMatch('m6', {
      alice: { userId: 'alice', color: 'white' },
      bob: { userId: 'bob', color: 'black' },
    });

    // 1. f3 e5 2. g4 (Fool's mate pre-move).
    await submit('m6', 'alice', { row: 8, col: 5 }, { row: 7, col: 5 });
    await submit('m6', 'bob', { row: 3, col: 4 }, { row: 5, col: 4 });
    await submit('m6', 'alice', { row: 8, col: 6 }, { row: 6, col: 6 });

    // 2... Qh4#
    // The black queen on d8 (row 2, col 3) moves to h4 (row 6, col 7).
    const result = await submit('m6', 'bob', { row: 2, col: 3 }, { row: 6, col: 7 });
    expect(result).toMatchObject({ ok: true, san: 'Qh4#', isCheckmate: true, outcome: 'checkmate' });

    const game = await lastGame('m6');
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('black');
  });
});
