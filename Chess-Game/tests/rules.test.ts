/**
 * Security rules verification.
 *
 * Uses @firebase/rules-unit-testing against the RTDB emulator, which is the
 * official way to assert what a client may and may not write. The point of
 * these tests is that the authoritative game state - the board, the move
 * list, the winner - cannot be tampered with by a player, because the server
 * validates every move and writes the result itself.
 *
 * Start the emulator first:
 *   npx firebase emulators:start --only auth,database --project demo-chess
 * Then:
 *   npx vitest run rules
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, set, update, get } from 'firebase/database';
import { beforeAll, afterAll, describe, it } from 'vitest';

const PROJECT_ID = 'demo-chess';
const DB_EMULATOR_PORT = 9100;

let env: RulesTestEnvironment;
type TestDb = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['database']>;

let aliceDb: TestDb;
let bobDb: TestDb;

// A unique match id per run: the rules only allow creating a match once, so
// reusing an id would fail on the second run against the same emulator.
const MATCH = `m${Date.now().toString(36)}`;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      host: '127.0.0.1',
      port: DB_EMULATOR_PORT,
      rules: readFileSync(join(process.cwd(), 'database.rules.json'), 'utf8'),
    },
  });

  // Two signed-in players in the same match.
  aliceDb = env.authenticatedContext('alice').database();
  bobDb = env.authenticatedContext('bob').database();

  // Alice creates the match (the matchmaking flow writes the whole node),
  // then each player fills in their own slot.
  await assertSucceeds(
    set(ref(aliceDb, `matches/${MATCH}`), {
      players: [
        { userId: 'alice', displayName: 'Alice', color: 'white', ready: false, timeout: false },
        { userId: 'bob', displayName: 'Bob', color: 'black', ready: false, timeout: false },
      ],
      gameMode: 'classic',
      timeControl: 300,
      status: 'waiting',
      createdAt: 0,
      readyStartedAt: 0,
      readyDuration: 10,
    }),
  );
});

afterAll(async () => {
  await env.cleanup();
});

describe('authoritative game state', () => {
  it('does not let a player write the game board', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/game`), { board: 'TAMPERED' }));
  });

  it('does not let a player write the game move list', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/game/moves`), [{ san: 'e4' }]));
  });

  it('does not let a player write the game winner', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/game/winner`), 'white'));
  });

  it('does not let a player write the match winner', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/winner`), 'white'));
  });

  it('does not let a player finish the match', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/status`), 'finished'));
  });

  it('does not let a player write the match board', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/board`), [['x']]));
  });

  it('does not let a player write another player slot', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/players/1/ready`), true));
  });
});

describe('match lifecycle', () => {
  it('lets a player create a match they belong to', async () => {
    await assertSucceeds(
      set(ref(aliceDb, `matches/${MATCH}-b`), {
        players: [
          { userId: 'alice', displayName: 'Alice', color: 'white', ready: false, timeout: false },
          { userId: 'bob', displayName: 'Bob', color: 'black', ready: false, timeout: false },
        ],
        status: 'waiting',
      }),
    );
  });

  it('does not let a player create a match they are not part of', async () => {
    await assertFails(
      set(ref(aliceDb, `matches/${MATCH}-c`), {
        players: [
          { userId: 'carol', displayName: 'Carol', color: 'white', ready: false, timeout: false },
          { userId: 'dave', displayName: 'Dave', color: 'black', ready: false, timeout: false },
        ],
        status: 'waiting',
      }),
    );
  });

  it('does not let a player overwrite an existing match', async () => {
    await assertFails(
      set(ref(aliceDb, `matches/${MATCH}`), {
        players: [{ userId: 'alice', color: 'white' }],
        status: 'waiting',
      }),
    );
  });

  it('does not let a player declare the match finished', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/status`), 'finished'));
  });

  it('does not let a player declare themselves the winner', async () => {
    await assertFails(set(ref(aliceDb, `matches/${MATCH}/winner`), 'white'));
  });

  it('lets a player cancel the match', async () => {
    await assertSucceeds(set(ref(aliceDb, `matches/${MATCH}/status`), 'cancelled'));
  });
});

describe('player-owned state', () => {
  it('lets a player set their own ready flag', async () => {
    await assertSucceeds(set(ref(aliceDb, `matches/${MATCH}/players/0/ready`), true));
  });

  it('lets a player set the other player ready flag out of band', async () => {
    // Writing into the other slot's subtree is blocked, but the slot itself
    // belongs to them by uid, so their own uid slot stays writable.
    await assertSucceeds(set(ref(bobDb, `matches/${MATCH}/players/1/ready`), true));
  });

  it('lets a player set their own timeout flag', async () => {
    await assertSucceeds(set(ref(aliceDb, `matches/${MATCH}/players/0/timeout`), true));
  });

  it('lets a player update their own time remaining', async () => {
    await assertSucceeds(update(ref(aliceDb, `matches/${MATCH}/players/0`), { timeRemaining: 120 }));
  });

  it('lets a player offer a draw', async () => {
    await assertSucceeds(set(ref(aliceDb, `matches/${MATCH}/players/0/offerDraw`), true));
  });

  it('lets a player cancel the match', async () => {
    await assertSucceeds(set(ref(aliceDb, `matches/${MATCH}/status`), 'cancelled'));
  });
});

describe('reads', () => {
  it('lets a player read the game state', async () => {
    await assertSucceeds(get(ref(aliceDb, `matches/${MATCH}/game`)));
  });

  it('lets a player read their match', async () => {
    await assertSucceeds(get(ref(aliceDb, `matches/${MATCH}`)));
  });

  it('does not let a player read the matchmaking queue', async () => {
    await assertFails(get(ref(aliceDb, 'matchmaking/queue')));
  });
});
