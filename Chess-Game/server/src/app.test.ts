/**
 * HTTP API tests.
 *
 * The API is exercised end to end over a real socket, but with the
 * transport-level concerns stubbed out: the game storage is in-memory, and
 * the auth resolver returns a fixed uid, so no Firebase project is needed.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { GameService } from '@chess-game/game-service';
import { InMemoryGameStorage } from '@chess-game/game-service';
import { createApp } from './app';
import type { Config } from './config';

const storage = new InMemoryGameStorage();
const service = new GameService(storage);

const config: Config = {
  port: 0,
  projectId: 'test-project',
  databaseURL: 'https://test-project-default-rtdb.firebaseio.com',
  serviceAccount: null,
  allowedOrigins: ['*'],
};

// A deterministic auth resolver: the bearer token IS the uid.
const resolveAuth = async (
  _config: Config,
  authorizationHeader: string | undefined,
): Promise<{ uid: string }> => ({
  uid: authorizationHeader?.replace(/^Bearer\s+/i, '') ?? '',
});

let base: string;
let server: Server;

beforeAll(async () => {
  const app = createApp({ config, service, resolveAuth });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind to a TCP port.');
  }
  base = `http://127.0.0.1:${address.port}`;

  // Seed a match with two players and a fresh game.
  storage.seedPlayers('m1', [
    { userId: 'alice', displayName: 'Alice', photoURL: null, rank: 1200, color: 'white' },
    { userId: 'bob', displayName: 'Bob', photoURL: null, rank: 1200, color: 'black' },
  ]);
  await service.createGame('m1');
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function headers(uid: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${uid}` };
}

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, projectId: 'test-project' });
  });
});

describe('POST /api/match/:id/game', () => {
  it('rejects an unauthenticated call', async () => {
    const res = await fetch(`${base}/api/match/m2/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('creates a new game', async () => {
    storage.seedPlayers('m2', [
      { userId: 'alice', displayName: 'Alice', photoURL: null, rank: 1200, color: 'white' },
    ]);
    const res = await fetch(`${base}/api/match/m2/game`, {
      method: 'POST',
      headers: headers('alice'),
      body: '{}',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, alreadyExisted: false });
  });
});

describe('POST /api/match/:id/move', () => {
  it('applies a legal move', async () => {
    const res = await fetch(`${base}/api/match/m1/move`, {
      method: 'POST',
      headers: headers('alice'),
      body: JSON.stringify({ from: { row: 8, col: 4 }, to: { row: 6, col: 4 } }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, san: 'e4', currentTurn: 'black' });
  });

  it('rejects an out-of-turn move', async () => {
    const res = await fetch(`${base}/api/match/m1/move`, {
      method: 'POST',
      headers: headers('alice'),
      body: JSON.stringify({ from: { row: 8, col: 3 }, to: { row: 6, col: 3 } }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe('It is not your turn.');
  });

  it('rejects an illegal move', async () => {
    const res = await fetch(`${base}/api/match/m1/move`, {
      method: 'POST',
      headers: headers('bob'),
      body: JSON.stringify({ from: { row: 3, col: 4 }, to: { row: 6, col: 4 } }),
    });
    expect(res.status).toBe(422);
  });

  it('rejects an unknown player', async () => {
    const res = await fetch(`${base}/api/match/m1/move`, {
      method: 'POST',
      headers: headers('mallory'),
      body: JSON.stringify({ from: { row: 3, col: 4 }, to: { row: 5, col: 4 } }),
    });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/match/:id/end', () => {
  it('ends the game by resignation', async () => {
    const res = await fetch(`${base}/api/match/m1/end`, {
      method: 'POST',
      headers: headers('alice'),
      body: JSON.stringify({ reason: 'resignation' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, winner: 'black' });
  });
});
