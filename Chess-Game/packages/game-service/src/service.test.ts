import { beforeEach, describe, expect, it } from 'vitest';
import { GameService, GameError } from '../src/index';
import { InMemoryGameStorage } from './memory';

describe('GameService', () => {
  let storage: InMemoryGameStorage;
  let service: GameService;

  const alice = 'alice';
  const bob = 'bob';

  beforeEach(async () => {
    storage = new InMemoryGameStorage();
    service = new GameService(storage);
    storage.seedPlayers('m1', [
      { userId: alice, displayName: 'Alice', photoURL: null, rank: 1200, color: 'white' },
      { userId: bob, displayName: 'Bob', photoURL: null, rank: 1200, color: 'black' },
    ]);
    await service.createGame('m1');
  });

  it('writes the starting position on create', async () => {
    const game = await storage.readGame('m1');
    expect(game?.currentTurn).toBe('white');
    expect(game?.moves).toEqual([]);
    expect(game?.status).toBe('playing');
    expect(game?.board[2]).toEqual(['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br', '', '']);
    expect(game?.board[9]).toEqual(['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', '', '']);
  });

  it('is idempotent on create', async () => {
    const result = await service.createGame('m1');
    expect(result.alreadyExisted).toBe(true);
    const game = await storage.readGame('m1');
    expect(game?.moves).toHaveLength(0);
  });

  it('applies a legal move and records it in SAN', async () => {
    const result = await service.submitMove({
      matchId: 'm1',
      uid: alice,
      from: { row: 8, col: 4 }, // e2
      to: { row: 6, col: 4 }, // e4
    });

    expect(result).toMatchObject({ ok: true, san: 'e4', currentTurn: 'black' });

    const game = await storage.readGame('m1');
    expect(game?.moves).toHaveLength(1);
    expect(game?.moves[0]).toMatchObject({ san: 'e4', by: alice });
  });

  it('rejects an illegal move and leaves the board unchanged', async () => {
    await expect(
      service.submitMove({
        matchId: 'm1',
        uid: alice,
        from: { row: 9, col: 1 }, // b1 knight
        to: { row: 7, col: 1 }, // b3 - not a knight move
      }),
    ).rejects.toThrow(GameError);

    const game = await storage.readGame('m1');
    expect(game?.moves).toHaveLength(0);
    expect(game?.board[9]).toEqual(['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', '', '']);
  });

  it('rejects a move when it is not that player turn', async () => {
    await service.submitMove({
      matchId: 'm1',
      uid: alice,
      from: { row: 8, col: 4 },
      to: { row: 6, col: 4 },
    });
    // Now it is Bob turn, but Alice tries to move again.
    await expect(
      service.submitMove({
        matchId: 'm1',
        uid: alice,
        from: { row: 8, col: 3 },
        to: { row: 6, col: 3 },
      }),
    ).rejects.toThrow('It is not your turn.');
  });

  it('rejects a player who has no color in the match', async () => {
    await expect(
      service.submitMove({
        matchId: 'm1',
        uid: 'mallory',
        from: { row: 8, col: 4 },
        to: { row: 6, col: 4 },
      }),
    ).rejects.toThrow('It is not your turn.');
  });

  it('rejects a board that does not match the move history', async () => {
    await service.submitMove({
      matchId: 'm1',
      uid: alice,
      from: { row: 8, col: 4 },
      to: { row: 6, col: 4 },
    });

    // Tamper with the stored board.
    const tampered = await storage.readGame('m1');
    tampered!.board[5][0] = 'wp'; // a pawn teleporting to a5 - unreachable
    await storage.writeGame('m1', tampered!);

    await expect(
      service.submitMove({
        matchId: 'm1',
        uid: bob,
        from: { row: 3, col: 4 },
        to: { row: 5, col: 4 },
      }),
    ).rejects.toThrow('inconsistent');
  });

  it('rejects a move into a finished game', async () => {
    const game = await storage.readGame('m1');
    await storage.writeGame('m1', { ...game!, status: 'finished', winner: 'draw' });

    await expect(
      service.submitMove({
        matchId: 'm1',
        uid: alice,
        from: { row: 8, col: 4 },
        to: { row: 6, col: 4 },
      }),
    ).rejects.toThrow('Game already finished.');
  });

  it('finishes the game on checkmate', async () => {
    // 1. f3 e5 2. g4 Qh4# (Fool's mate)
    await service.submitMove({ matchId: 'm1', uid: alice, from: { row: 8, col: 5 }, to: { row: 7, col: 5 } });
    await service.submitMove({ matchId: 'm1', uid: bob, from: { row: 3, col: 4 }, to: { row: 5, col: 4 } });
    await service.submitMove({ matchId: 'm1', uid: alice, from: { row: 8, col: 6 }, to: { row: 6, col: 6 } });

    const result = await service.submitMove({
      matchId: 'm1',
      uid: bob,
      from: { row: 2, col: 3 }, // d8 queen
      to: { row: 6, col: 7 }, // h4
    });
    expect(result).toMatchObject({ san: 'Qh4#', isCheckmate: true, outcome: 'checkmate' });

    const game = await storage.readGame('m1');
    expect(game?.status).toBe('finished');
    expect(game?.winner).toBe('black');
  });

  it('records a capture', async () => {
    // 1. e4 d5 2. exd5
    await service.submitMove({ matchId: 'm1', uid: alice, from: { row: 8, col: 4 }, to: { row: 6, col: 4 } });
    await service.submitMove({ matchId: 'm1', uid: bob, from: { row: 3, col: 3 }, to: { row: 5, col: 3 } });

    const result = await service.submitMove({
      matchId: 'm1',
      uid: alice,
      from: { row: 6, col: 4 },
      to: { row: 5, col: 3 },
    });
    expect(result).toMatchObject({ san: 'exd5', capturedPiece: 'bp' });
  });

  it('ends the game by resignation', async () => {
    const result = await service.endGame('m1', alice, 'resignation');
    expect(result).toMatchObject({ ok: true, winner: 'black', reason: 'resignation' });

    const game = await storage.readGame('m1');
    expect(game?.status).toBe('finished');
    expect(game?.winner).toBe('black');
  });

  it('ends the game by agreed draw', async () => {
    const result = await service.endGame('m1', bob, 'draw');
    expect(result).toMatchObject({ winner: 'draw' });

    const match = storage.matches.get('m1');
    expect(match).toMatchObject({ status: 'finished', winner: 'draw' });
  });
});
