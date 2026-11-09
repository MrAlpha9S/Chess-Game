# Chess Game - Technical System Architecture & Implementation Blueprint

## 1. Executive Summary & Design Philosophy

This document outlines the system architecture and implementation blueprint for a web-based chess application. 
The system is architected as a **Serverless, Client-First application** running entirely on **Firebase Spark Plan (Free Tier)** and static frontend hosting (Vercel / Netlify).

### Extensibility Goal: Phase 1 to Phase 2 Transition
- **Phase 1 (Core Target):** Standard classical FIDE chess rules, matchmaking, real-time board synchronization, and authentication.
- **Phase 2 (Future Extension):** "Cờ Vua Thẻ Bài" (Card Chess) variant introducing 41 custom cards across 6 categories (Gold, Silver, Green, Blue, Bronze, Purple), hidden information mechanics (stealth pieces), dynamic grid resizing, and multi-stack cooldown skills.

To ensure zero rewriting of the core engine when moving from Phase 1 to Phase 2:
1. **10x10 Abstracted Grid System:** The board is internally modeled as a $10 \times 10$ coordinate matrix from Day 1. In Phase 1, the outer 36 border squares are immutably disabled, enforcing a standard $8 \times 8$ playable area. Phase 2 cards (Blue Cards - Boundary Extension/Abyss) can toggle square availability without re-indexing coordinates.
2. **Strategy & Factory Pattern:** The UI layer renders squares dynamically based on an abstract engine interface (`IChessEngine`). Moving to Phase 2 only requires plugging in a `VariantChessEngine` adapter without modifying React UI components.
3. **Commit-Reveal RTDB Schema:** The database schema isolates standard move histories from extended card states, enabling stealth mechanics (e.g., *Shadow Horseman*) and pre-game setup phases (e.g., *Locked*, card commitments) via Client-side validation enforced by Firebase Security Rules.

---

## 2. System Architecture & Data Flow Design

### 2.1 Architecture Topology

```
+-----------------------------------------------------------------------------------+
|                                  React Frontend                                   |
|                                                                                   |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  |     UI Layer           |  |      Game Engine        |  |  State Management  |  |
|  |  (Board, HUD, Modal)   |  | (chessops / Variant Ext)|  |  (Zustand Store)   |  |
|  +-----------+------------+  +------------+------------+  +---------+----------+  |
|              |                            |                         |             |
|              +--------------------+-------+-------------------------+             |
|                                   |                                               |
|                       +-----------v------------+                                  |
|                       |  Custom Hooks Layer    |                                  |
|                       | (useAuth, useGameSync) |                                  |
|                       +-----------+------------+                                  |
+-----------------------------------|-----------------------------------------------+
                                    |
            +-----------------------+-----------------------+
            | Firebase SDK (Client-side Direct Sync)        |
            +-----------------------+-----------------------+
                                    |
           +------------------------+------------------------+
           |                                                 |
           v                                                 v
+-----------------------+                         +---------------------+
|    Firebase Auth      |                         |    Firebase RTDB    |
| (Google OAuth Provider)|                         | (Rules-Enforced Sync|
|                       |                         |   No Backend Logic) |
+-----------------------+                         +---------------------+
```

### 2.2 Data Flow Execution Sequence

1. **Authentication:** Client authenticates directly via `signInWithPopup(auth, googleProvider)`. Obtains `uid`, `displayName`, and `photoURL`.
2. **Room Creation & Mode Negotiation:**
   - **Host:** Creates room at `/rooms/$roomId` specifying `mode` (`classic` for Phase 1, `card_ranked` for Phase 2). Initializes metadata and default FEN.
   - **Guest:** Joins room and claims `/rooms/$roomId/players/black`.
3. **Phase 2 Prep Steps (Skipped during Phase 1):**
   - Locked card selection (10s) -> Strategy choices lidded via commit hashes -> Simultaneous reveal.
4. **Main Move Validation & State Update:**
   - Active player interacts with UI.
   - Client calls local `IChessEngine.makeMove()` / `IChessEngine.useCard()`.
   - `chessops` (or Variant Engine) validates path, collision, check rules, and board boundaries.
   - Client calculates resulting state (FEN, active squares, cooldown stacks) and sends an **Atomic Update** to Firebase RTDB.
5. **Security Enforcement at Database Layer:**
   - Firebase RTDB Security Rules verify write payload against `auth.uid` and current room turn state. Illegal turn updates are rejected server-side by Firebase Rules.
6. **Real-Time Client Mirroring:**
   - Opponent client receives delta payload via RTDB `onValue()` subscription.
   - Local `IChessEngine` instance re-syncs state and triggers React UI re-render.

---

## 3. Database Schema Blueprint (Phase 1 & Phase 2 Ready)

```json
{
  "rooms": {
    "ROOM_ID_12345": {
      "metadata": {
        "createdAt": 1700000000000,
        "updatedAt": 1700000050000,
        "status": "in_progress", // "waiting" | "prep_phase" | "in_progress" | "completed"
        "mode": "classic",        // "classic" | "card_ranked" | "card_casual"
        "winner": null,           // "white" | "black" | "draw" | null
        "terminationReason": null,// "checkmate" | "stalemate" | "resignation" | "timeout"
        "timeControl": {
          "initialMs": 600000,
          "incrementMs": 5000
        }
      },
      "players": {
        "white": {
          "uid": "USER_ID_ALPHA",
          "displayName": "Alice",
          "photoURL": "https://lh3.googleusercontent.com/...",
          "timeRemainingMs": 600000
        },
        "black": {
          "uid": "USER_ID_BETA",
          "displayName": "Bob",
          "photoURL": "https://lh3.googleusercontent.com/...",
          "timeRemainingMs": 600000
        }
      },
      "boardState": {
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "turn": "white",
        "fullMoveNumber": 1,
        "halfMoveClock": 0,
        "lastMove": {
          "from": "e2",
          "to": "e4",
          "san": "e4",
          "timestamp": 1700000010000
        },
        "isCheck": false,
        "isGameOver": false,

        /* --- PHASE 2 PREPARED FIELDS (Default values used in Phase 1) --- */
        "gridConfig": {
          "minRow": 1, // Rows 1 to 8 (8x8 active centre inside the 10x10 matrix)
          "maxRow": 8,
          "minCol": 1, // Cols 1 to 8
          "maxCol": 8,
          "holes": []  // Array of destroyed squares (e.g. "4,4")
        },
        "variantState": {
          "royalTag": { "white": "e1", "black": "e8" }, // Position of King/Royal piece
          "hiddenPieces": {},                          // Stealth positions (Shadow Horseman)
          "activeBarriers": []                         // Boundaries (e.g. Major Conflict 6x6)
        }
      },
      "cardState": {
        /* --- PHASE 2 PREPARED CONTAINERS (Empty in Phase 1) --- */
        "white": {
          "deck": [],       // Max 3 card IDs
          "used": [],       // Used card IDs
          "cooldowns": {}   // { "card_id": remaining_turns }
        },
        "black": {
          "deck": [],
          "used": [],
          "cooldowns": {}
        }
      },
      "moveHistory": {
        "0": { "from": "e2", "to": "e4", "san": "e4", "type": "move", "by": "USER_ID_ALPHA", "timestamp": 1700000010000 }
      }
    }
  },
  "presence": {
    "USER_ID_ALPHA": {
      "status": "online",
      "activeRoom": "ROOM_ID_12345",
      "lastSeen": 1700000050000
    }
  }
}
```

---

## 4. Modular Frontend Architecture

### 4.1 Folder Structure

```
src/
├── components/              # Shared React UI Components
│   ├── common/
│   │   └── LoadingAnimation.tsx  # Waiting indicator (matchmaking|board-init|spinner)
│   ├── hud/
│   │   └── MoveLog.tsx           # SAN move history log
│   └── ui/                        # Button, Card, Dialog, Input, ScrollArea
├── contexts/
│   └── AuthContext.tsx       # Firebase auth + profile
├── engine/                  # Core & Variant Abstract Logic
│   ├── grid/
│   │   ├── BoardGrid10x10.ts # 10x10 Matrix Border Manager
│   │   ├── constants.ts      # Active-region constants (shared with the schema)
│   │   ├── coords.ts         # Grid <-> algebraic conversions
│   │   ├── board.ts          # GridBoard type and fenToGrid/gridToFen
│   │   └── initialBoard.ts   # The starting position
│   ├── core/
│   │   ├── IChessEngine.ts        # Abstract Unified Game Engine Interface
│   │   └── StandardEngine.ts      # Standard chessops Adapter (Phase 1 Engine)
│   ├── index.ts             # Public engine API
│   └── engine.test.ts       # Engine test suite
├── features/                # Screens, grouped by feature
│   ├── auth/LoginScreen.tsx
│   ├── board/components/
│   │   ├── BoardGrid.tsx    # Dynamic 10x10 Grid Renderer
│   │   └── Piece.tsx        # PNG sprite renderer
│   ├── lobby/LobbyScreen.tsx
│   ├── match/MatchScreen.tsx        # The main game screen
│   ├── result/ResultScreen.tsx
│   └── room/
│       ├── CreateRoomScreen.tsx
│       ├── JoinRoomScreen.tsx
│       └── WaitingRoomScreen.tsx
├── hooks/                   # Custom Hooks
│   ├── useGameSync.ts       # RTDB room listener & dispatcher
│   ├── useTimer.ts          # Clock synchronization hook
│   └── usePointerField.ts   # 3D pointer tilt
├── lib/
│   ├── audio.ts             # Web Audio sound effects
│   └── firebase.ts          # Firebase core initialization
├── services/
│   └── roomService.ts       # The only data service: /rooms and /presence
├── stores/
│   ├── useGameStore.ts      # Time control selection
│   └── useSettingsStore.ts  # Sound and pointer-field preferences
├── types/
│   ├── index.ts             # Shared UI types
│   └── room.ts              # The room schema (mirrors §3)
└── App.tsx
```

The `variants/` folder, the card components, and the card data are Phase 2
work and are not present in Phase 1.

---

## 5. Security Strategy & Firebase Rules

Firebase Realtime Database Security Rules strictly regulate game synchronization by preventing out-of-turn writes, unauthorized edits to player metadata, or invalid FEN timestamps.

### `database.rules.json`

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null && !data.exists()",

        "metadata": {
          ".write": "auth != null && (
            !data.exists() ||
            root.child('rooms/' + $roomId + '/players/white/uid').val() === auth.uid ||
            root.child('rooms/' + $roomId + '/players/black/uid').val() === auth.uid
          )"
        },

        "players": {
          ".write": "auth != null && (
            !data.exists() ||
            root.child('rooms/' + $roomId + '/players/white/uid').val() === auth.uid ||
            root.child('rooms/' + $roomId + '/players/black/uid').val() === auth.uid
          )",

          "white": {
            ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)"
          },
          "black": {
            ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)"
          }
        },

        "boardState": {
          ".write": "auth != null && (
            (!data.exists() && root.child('rooms/' + $roomId + '/players/white/uid').val() === auth.uid) ||
            (data.child('turn').val() === 'white' && root.child('rooms/' + $roomId + '/players/white/uid').val() === auth.uid && newData.child('turn').val() === 'black') ||
            (data.child('turn').val() === 'black' && root.child('rooms/' + $roomId + '/players/black/uid').val() === auth.uid && newData.child('turn').val() === 'white')
          )",
          ".validate": "!newData.exists() || (newData.hasChildren(['fen', 'turn']) && newData.child('fen').isString())"
        },

        "moveHistory": {
          "$moveId": {
            ".write": "auth != null && newData.child('by').val() === auth.uid",
            ".validate": "newData.hasChildren(['from', 'to', 'san', 'timestamp'])"
          }
        },

        "cardState": {
          ".write": "auth != null && (
            root.child('rooms/' + $roomId + '/players/white/uid').val() === auth.uid ||
            root.child('rooms/' + $roomId + '/players/black/uid').val() === auth.uid
          )"
        }
      }
    },
    "presence": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

---

## 6. Code Blueprints

### 6.1 Abstract Grid Manager ($10 \times 10$ Boundary System)

This grid manager enforces standard $8 \times 8$ boundaries in Phase 1, but exposes methods (`unlockSquare`, `addHole`) to instantly enable Phase 2 Blue card mechanics.

`src/engine/grid/BoardGrid10x10.ts`
```typescript
export interface Coordinate {
  row: number; // 0 to 9
  col: number; // 0 to 9
}

export class BoardGrid10x10 {
  private activeBounds = { minRow: 1, maxRow: 8, minCol: 1, maxCol: 8 };
  private holes: Set<string> = new Set();

  constructor(isPhase1: boolean = true) {
    if (isPhase1) {
      this.resetToPhase1Bounds();
    }
  }

  public resetToPhase1Bounds(): void {
    // Phase 1 enforces the standard 8x8 in rows 1..8 and cols 1..8
    // (0-indexed): the centred block of the 10x10 matrix, leaving the
    // outer 36 squares locked.
    this.activeBounds = { minRow: 1, maxRow: 8, minCol: 1, maxCol: 8 };
    this.holes.clear();
  }

  public get activeBounds(): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
    return this.activeBounds;
  }

  public isSquarePlayable(row: number, col: number): boolean {
    if (
      row < this.activeBounds.minRow ||
      row > this.activeBounds.maxRow ||
      col < this.activeBounds.minCol ||
      col > this.activeBounds.maxCol
    ) {
      return false;
    }
    return !this.holes.has(`${row},${col}`);
  }

  // Phase 2 Extensibility Hooks
  public unlockSquare(row: number, col: number): void {
    this.activeBounds.minRow = Math.min(this.activeBounds.minRow, row);
    this.activeBounds.maxRow = Math.max(this.activeBounds.maxRow, row);
    this.activeBounds.minCol = Math.min(this.activeBounds.minCol, col);
    this.activeBounds.maxCol = Math.max(this.activeBounds.maxCol, col);
  }

  public setHole(row: number, col: number): void {
    this.holes.add(`${row},${col}`);
  }
}
```

The algebraic conversions live in `src/engine/grid/coords.ts` and are shared by the
grid manager and the engine, so the mapping can only live in one place.
Grid row 1 is rank 8 (the black back rank, top-down) and column 1 is file
`a`.
```typescript
// grid -> chessops square (0..63)
gridToSquare(row, col) = (8 - row) * 8 + (col - 1)
// chessops square -> grid
RANK_TO_ROW[rank - 1] = 9 - rank        // rank 8 -> row 1
FILE_TO_COL[file]     = file + 1        // file a (0) -> col 1
```

### 6.2 Core Unified Engine Interface

`src/engine/core/IChessEngine.ts`
```typescript
export type Color = 'white' | 'black';

export interface MoveRequest {
  from: string; // e.g., "e2"
  to: string;   // e.g., "e4"
  promotion?: 'q' | 'r' | 'b' | 'n';
  cardPayload?: {
    cardId: string;
    targetSquare?: string;
  };
}

export interface MoveResult {
  isValid: boolean;
  newFen: string;
  san: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  capturedPiece?: string;
  errorReason?: string;
}

export interface IChessEngine {
  init(fen?: string): void;
  getLegalMoves(square: string): string[];
  makeMove(request: MoveRequest): MoveResult;
  getFen(): string;
  getTurn(): Color;
  isGameOver(): boolean;
}
```

### 6.3 Phase 1 Standard Engine Adapter (`chessops`)

`src/engine/core/StandardEngine.ts`
```typescript
import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseSquare, makeSquare, parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { IChessEngine, MoveRequest, MoveResult, Color } from './IChessEngine';
import { BoardGrid10x10 } from '../grid/BoardGrid10x10';
import { gridToSquare, squareToGrid } from '../grid/coords';

export class StandardEngine implements IChessEngine {
  private pos!: Chess;
  private gridManager: BoardGrid10x10;

  constructor(fen?: string) {
    this.gridManager = new BoardGrid10x10(true);
    this.init(fen);
  }

  public init(fen?: string): void {
    const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const parsed = parseFen(fen || defaultFen);
    // chessops 0.15 exposes `isErr` as a property, not a method.
    if (parsed.isErr) {
      throw new Error(`Invalid FEN: ${fen}`);
    }
    const chessRes = Chess.fromSetup(parsed.unwrap());
    if (chessRes.isErr) {
      throw new Error('Invalid chess setup from FEN');
    }
    this.pos = chessRes.unwrap();
  }

  public getLegalMoves(squareStr: string): string[] {
    const sq = parseSquare(squareStr);
    if (sq === undefined) return [];

    const dests: string[] = [];
    for (const to of this.pos.dests(sq)) {
      const destSquareStr = makeSquare(to);
      const coord = squareToGrid(to);

      // Enforce 10x10 grid boundaries
      if (coord && this.gridManager.isSquarePlayable(coord.row, coord.col)) {
        dests.push(destSquareStr);
      }
    }
    return dests;
  }

  public makeMove(request: MoveRequest): MoveResult {
    const uciString = `${request.from}${request.to}${request.promotion || ''}`;
    const move = parseUci(uciString);

    if (!move) {
      return this.reject('Invalid move representation');
    }

    const fromSq = parseSquare(request.from);
    const toSq = parseSquare(request.to);

    if (fromSq === undefined || toSq === undefined) {
      return this.reject('Square parsing failed');
    }

    // `isLegal` covers the two cases where the destination is not literally
    // one of the pseudo-legal targets: castling is encoded as king-takes-
    // rook, and en passant targets a square no piece stands on. Testing
    // `dests.has(toSq)` rejects both.
    if (!this.pos.isLegal(move)) {
      return this.reject('Illegal move');
    }

    const captured = this.pos.board.get(toSq);
    const san = makeSan(this.pos, move);
    this.pos.play(move);

    const newFen = makeFen(this.pos.toSetup());
    const isCheck = this.pos.isCheck();
    const isEnd = this.pos.isEnd();

    return {
      isValid: true,
      newFen,
      san,
      isCheck,
      isCheckmate: isEnd && isCheck,
      isStalemate: isEnd && !isCheck,
      capturedPiece: captured ? `${captured.color}${captured.role}` : undefined,
    };
  }

  public getFen(): string {
    return makeFen(this.pos.toSetup());
  }

  public getTurn(): Color {
    return this.pos.turn === 'white' ? 'white' : 'black';
  }

  public isGameOver(): boolean {
    return this.pos.isEnd();
  }
}
```

### 6.4 Realtime Match Synchronization Hook

`src/hooks/useGameSync.ts`
```typescript
import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { StandardEngine } from '../engine/core/StandardEngine';
import { MoveRequest } from '../engine/core/IChessEngine';

export interface GameSnapshot {
  fen: string;
  turn: 'white' | 'black';
  status: string;
  whiteUid: string;
  blackUid: string;
}

export function useGameSync(roomId: string, currentUserId: string) {
  const [engine] = useState(() => new StandardEngine());
  const [gameState, setGameState] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(rtdb, `rooms/${roomId}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setError('Room does not exist');
        return;
      }

      const fen = data.boardState?.fen;
      if (fen) {
        engine.init(fen);
      }

      setGameState({
        fen: data.boardState?.fen,
        turn: data.boardState?.turn,
        status: data.metadata?.status,
        whiteUid: data.players?.white?.uid,
        blackUid: data.players?.black?.uid,
      });
    });

    return () => unsubscribe();
  }, [roomId, engine]);

  const executeMove = useCallback(
    async (move: MoveRequest) => {
      if (!gameState) return false;

      const playerColor = gameState.whiteUid === currentUserId ? 'white' : gameState.blackUid === currentUserId ? 'black' : null;
      if (playerColor !== gameState.turn) {
        setError("Not your turn!");
        return false;
      }

      const result = engine.makeMove(move);
      if (!result.isValid) {
        setError(result.errorReason || 'Illegal move executed');
        return false;
      }

      const nextTurn = gameState.turn === 'white' ? 'black' : 'white';
      const updates: Record<string, unknown> = {};

      updates[`rooms/${roomId}/boardState/fen`] = result.newFen;
      updates[`rooms/${roomId}/boardState/turn`] = nextTurn;
      updates[`rooms/${roomId}/boardState/isCheck`] = result.isCheck;
      updates[`rooms/${roomId}/boardState/isGameOver`] = result.isCheckmate || result.isStalemate;
      updates[`rooms/${roomId}/boardState/lastMove`] = {
        ...move,
        san: result.san,
        timestamp: serverTimestamp(),
      };
      updates[`rooms/${roomId}/metadata/updatedAt`] = serverTimestamp();

      if (result.isCheckmate) {
        updates[`rooms/${roomId}/metadata/status`] = 'completed';
        updates[`rooms/${roomId}/metadata/winner`] = playerColor;
        updates[`rooms/${roomId}/metadata/terminationReason`] = 'checkmate';
      }

      try {
        await update(ref(rtdb), updates);
        setError(null);
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Database sync failed';
        setError(message);
        return false;
      }
    },
    [gameState, roomId, currentUserId, engine]
  );

  return { engine, gameState, executeMove, error };
}
```