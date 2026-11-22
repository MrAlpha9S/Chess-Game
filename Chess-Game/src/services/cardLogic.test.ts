import { describe, expect, it } from 'vitest';
import {
  ABYSS_COOLDOWN_TURNS,
  cardInDeck,
  cardUnavailableReason,
  CARD_OPENING_LOCK_FULL_MOVES,
  cooldownOf,
  tickCooldowns,
  toIdArray,
} from './cardLogic';
import type { Room, RoomCardSide } from '../types/room';

/** A minimal card-mode room in progress, white to move on move 6. */
function roomOverrides(overrides?: Partial<Room>): Room {
  return {
    metadata: {
      createdAt: 0,
      updatedAt: 0,
      status: 'in_progress',
      mode: 'card',
      winner: null,
      terminationReason: null,
      timeControl: { initialMs: 600000, incrementMs: 0 },
    },
    players: {
      white: { uid: 'me', displayName: 'W', photoURL: null, rank: 1000, timeRemainingMs: 600000 },
      black: { uid: 'them', displayName: 'B', photoURL: null, rank: 1000, timeRemainingMs: 600000 },
    },
    boardState: {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 6',
      turn: 'white',
      fullMoveNumber: 6,
      halfMoveClock: 0,
      lastMove: null,
      isCheck: false,
      isGameOver: false,
      gridConfig: {
        minRow: 1,
        maxRow: 8,
        minCol: 1,
        maxCol: 8,
        holes: [],
      },
      variantState: createEmptyVariantStateSafe(),
    },
    cardState: {
      white: {
        deck: ['abyss', 'tower'],
        used: [],
        cooldowns: {},
        ready: true,
      },
      black: { deck: [], used: [], cooldowns: {}, ready: true },
    },
    moveHistory: {},
    ...overrides,
  };
}

// Avoid importing a helper that itself would need the room type; the empty
// variant state is small enough to inline here.
function createEmptyVariantStateSafe() {
  return {
    royalTag: { white: null, black: null },
    hiddenPieces: {},
    activeBarriers: [],
    transformed: {},
    barrier: null,
  };
}

describe('toIdArray', () => {
  it('passes a plain array through, dropping non-strings', () => {
    expect(toIdArray(['abyss', 3])).toEqual(['abyss']);
  });

  it('rebuilds an RTDB numeric-key object into a plain array', () => {
    expect(toIdArray({ 0: 'abyss', 1: 'tower' })).toEqual(['abyss', 'tower']);
  });

  it('returns [] for anything else', () => {
    expect(toIdArray(undefined)).toEqual([]);
    expect(toIdArray({ 'x': 'abyss' })).toEqual([]);
    expect(toIdArray('abyss')).toEqual([]);
  });
});

describe('cooldownOf', () => {
  it('returns 0 for absent cards and unknown sides', () => {
    expect(cooldownOf(undefined, 'abyss')).toBe(0);
    expect(cooldownOf({ deck: [], used: [], cooldowns: {}, ready: false }, 'abyss')).toBe(0);
  });

  it('returns the stored value when cooling down', () => {
    expect(cooldownOf({ deck: [], used: [], cooldowns: { abyss: 15 }, ready: false }, 'abyss')).toBe(15);
  });

  it('never reports a negative cooldown', () => {
    expect(cooldownOf({ deck: [], used: [], cooldowns: { abyss: -2 }, ready: false }, 'abyss')).toBe(0);
  });
});

describe('cardInDeck', () => {
  it('finds the card in a stored deck', () => {
    const side: RoomCardSide = { deck: ['abyss'], used: [], cooldowns: {}, ready: true };
    expect(cardInDeck(side, 'abyss')).toBe(true);
    const other: RoomCardSide = { deck: ['tower'], used: [], cooldowns: {}, ready: true };
    expect(cardInDeck(other, 'abyss')).toBe(false);
  });

  it('reads an RTDB object deck correctly', () => {
    const side = { deck: { 0: 'abyss' } } as unknown as RoomCardSide;
    expect(cardInDeck(side, 'abyss')).toBe(true);
  });
});

describe('cardUnavailableReason', () => {
  it('allows the card when everything lines up', () => {
    expect(cardUnavailableReason(roomOverrides(), 'white', 'abyss')).toBeNull();
  });

  it('rejects use when it is not the owner turn', () => {
    const room = roomOverrides();
    room.boardState!.turn = 'black';
    expect(cardUnavailableReason(room, 'white', 'abyss')).toBe('It is not your turn.');
  });

  it('rejects use before the opening lock lifts', () => {
    const room = roomOverrides();
    room.boardState!.fullMoveNumber = 3;
    const reason = cardUnavailableReason(room, 'white', 'abyss');
    expect(reason).toBe(`Cards unlock from move ${CARD_OPENING_LOCK_FULL_MOVES}.`);
  });

  it('rejects use for a card not in the deck', () => {
    const room = roomOverrides();
    room.cardState.white = { deck: ['tower'], used: [], cooldowns: {}, ready: true };
    expect(cardUnavailableReason(room, 'white', 'abyss')).toBe(
      'That card is not in your deck.',
    );
  });

  it('rejects use while the cooldown runs', () => {
    const room = roomOverrides();
    room.cardState.white.cooldowns = { abyss: 15 };
    expect(cardUnavailableReason(room, 'white', 'abyss')).toBe(
      'The Abyss (Vực Thẳm) is on cooldown: 15 turns.',
    );
  });

  it('rejects use once the game is completed', () => {
    const room = roomOverrides();
    room.metadata.status = 'completed';
    expect(cardUnavailableReason(room, 'white', 'abyss')).toBe('The game is over.');
  });
});

describe('tickCooldowns', () => {
  it('drops every cooling-down deck card by one', () => {
    const side = roomOverrides().cardState.white;
    side.cooldowns = { abyss: 4, tower: 2 };
    const next = tickCooldowns(side);
    expect(next).toEqual({ abyss: 3, tower: 1 });
  });

  it('touches only the deck cards that are cooling down', () => {
    const side = roomOverrides().cardState.white;
    side.cooldowns = { tower: 1 };
    const next = tickCooldowns(side);
    expect(next).toEqual({ tower: 0 });
    expect('abyss' in next).toBe(false);
  });

  it('returns nothing for a side with no deck', () => {
    expect(tickCooldowns(undefined)).toEqual({});
    expect(tickCooldowns({ deck: [], used: [], cooldowns: {}, ready: true })).toEqual({});
  });
});

it('declares a 15-turn cooldown for The Abyss', () => {
  expect(ABYSS_COOLDOWN_TURNS).toBe(15);
});
