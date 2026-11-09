# Chess — Online 1v1

A real-time online chess game for two players, built as a serverless app on
Firebase. There is no game server: the rules live in the browser, the
position lives in Realtime Database, and the database rules stop a player from
taking a turn that is not theirs.

The board is modelled on a 10×10 matrix from day one, with the standard 8×8
locked into the centre. The 36 locked border squares are not decoration — they
are the space Phase 2's Blue Cards will open up for boundary extension, with
no coordinate renumbering needed when they do.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Firebase project keys
npm run dev
```

Open the app in two browsers, sign in with two different Google accounts, and
create a room in one and join it from the other with the six-character code.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production |
| `npm test` | Run the test suite |
| `npm run test:engine` | Run only the engine tests |
| `npm run generate:pieces` | Regenerate the piece sprites |
| `npm run deploy` | Build and deploy to Firebase Hosting and Database |

## Architecture

```
Browser A                    Realtime Database                 Browser B
┌──────────────┐             ┌──────────────────┐             ┌──────────────┐
│ StandardEngine│ ──write──▶ │  /rooms/{id}     │ ──read──▶  │ StandardEngine│
│ validates the │             │  boardState.fen  │             │ renders the  │
│ move locally  │             │  moveHistory     │             │ position     │
└──────────────┘             │  players.*.clock │             └──────────────┘
                             └──────────────────┘
                                    ▲
                             Security Rules: only the
                             player whose turn it is may write
                             boardState, and only if the
                             turn actually changes
```

**The client owns the rules.** Every move is validated against the full
chess ruleset by `chessops` before anything is written, so an illegal move
never reaches the database in the first place.

**The rules are the backstop.** Security Rules independently require that the
writer owns the side to move and that the turn actually flips. A tampered
client that skips validation still cannot move out of turn or write two moves
in a row.

**The clock is shared.** The remaining time lives in the room, not in either
browser. Each client interpolates between the last stored value and the
current time so the display is smooth, and writes the real value back about
once a second while it is that player's turn.

### Where things live

| Path | What it holds |
|---|---|
| `src/engine/` | The rules. `StandardEngine` wraps `chessops`; `grid/` holds the 10×10 geometry. |
| `src/services/roomService.ts` | The only data service. Every write is a single atomic multi-path patch. |
| `src/hooks/useGameSync.ts` | Subscribes to a room and dispatches moves. |
| `src/hooks/useTimer.ts` | The synchronised clock. |
| `src/features/match/MatchScreen.tsx` | The game screen. |
| `src/types/room.ts` | The room schema, mirroring the architecture document. |

## Phase 1 scope

Phase 1 is classic chess: rooms, a synchronised board and clock, move
history, and the end-of-game handling for checkmate, stalemate, insufficient
material, the fifty-move rule, resignation, timeout, and agreed draws.

Cards are Phase 2. The `cardState` container already exists in the room
schema so the shape does not have to change later, but it is empty for now.

## The honesty of the anti-cheat

Security Rules check *who* is writing and *when*, not *what* they write. A
player who edits their own client could in principle write a FEN that no
legal sequence of moves reaches, as long as the turn flips correctly.

Two things limit that. The client validates every move with the real ruleset,
so a cheat has to deliberately bypass the validation rather than fail to
trigger it. And any position that does not correspond to the recorded move
history is detectable by replaying the history — the engine exposes
`replayMoves` for exactly this check.

Closing the gap entirely needs a trusted referee, which means giving up the
serverless design that keeps this project free to run. That trade is
deliberate, and it is the right one for Phase 1.

## Testing

The engine test suite covers the rules that are easy to get subtly wrong:
castling, en passant, promotion, pins, checkmate, stalemate, insufficient
material, and replaying a game from its move list.

```bash
npm run test:engine
```

## Licence

MIT
