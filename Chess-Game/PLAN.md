# Match & Game Flow Implementation Plan

## Context

Khi 2 người chơi cùng queue trong matchmaking, cần:
1. Tự động tạo match trong RTDB
2. Xóa queue entries của 2 người
3. Ready phase 10s với timer đồng bộ
4. Nếu 1 trong 2 không ready → hủy match, về lobby
5. Nếu cả 2 ready → bắt đầu game
6. Game state lưu trong RTDB, xóa khi kết thúc hoặc tab đóng

---

## Phase 1: Update Match Data Model

**File:** `src/services/matchmaking.ts`

Thêm trường mới vào Match model:
```typescript
{
  players: { [playerId]: { userId, displayName, photoURL, rank, color, ready } },
  gameMode: string,
  timeControl: number,
  status: 'waiting' | 'ready' | 'playing' | 'finished' | 'cancelled',
  readyStartedAt: number | null,  // timestamp khi ready phase bắt đầu
  readyDuration: 10,            // 10 seconds
  winner?: string,
  createdAt: number,
}
```

---

## Phase 2: Auto-create Match khi 2 người cùng Queue

**File:** `src/services/matchmaking.ts`

Sửa `findOpponent()`:
1. Tìm opponent phù hợp trong queue
2. **Tạo match ngay** trong RTDB với cả 2 players
3. **Xóa** 2 queue entries
4. **Set** `status: 'ready'`, `readyStartedAt: timestamp`
5. Return match info cho client

```typescript
async findOpponent(...): Promise<{ matchId, opponent, isNewMatch: boolean }>
```

---

## Phase 3: Ready Phase Service

**File:** `src/services/matchmaking.ts`

Thêm methods:
```typescript
// Set player ready
async setReady(matchId: string, userId: string): Promise<{ bothReady: boolean }>

// Cancel ready / refuse
async cancelReady(matchId: string, userId: string): Promise<void>

// Get current match state (for timer sync)
async getMatchState(matchId: string): Promise<MatchState | null>

// End/cancel match
async cancelMatch(matchId: string): Promise<void>

// Cleanup when game ends
async cleanupMatch(matchId: string): Promise<void>
```

Logic `setReady()`:
1. Set `ready: true` cho player
2. Kiểm tra cả 2 đã ready?
   - **Có**: Set `status: 'playing'`, trigger game creation
   - **Không**: Chờ

Logic `cancelReady()`:
1. Set `status: 'cancelled'`
2. Navigate cả 2 về lobby

---

## Phase 4: MatchmakingScreen Updates

**File:** `src/features/matchmaking/MatchmakingScreen.tsx`

### 4.1 Khi tìm thấy match → Show Ready Screen
```typescript
// Thay vì navigate sang /preparation
// Hiển thị Ready Screen với timer

const [matchState, setMatchState] = useState<{
  matchId: string;
  opponent: {...};
  status: 'ready';
  readyStartedAt: number;
  isReady: boolean;
  opponentReady: boolean;
} | null>(null);

// Subscribe to match updates
useEffect(() => {
  matchmakingService.onMatchUpdate(matchId, (match) => {
    // Update UI
    // Handle cancel/ready status
  });
}, [matchId]);
```

### 4.2 Ready Screen UI
- Hiển thị opponent info
- Timer 10s đếm ngược (tính từ `readyStartedAt`)
- Button "Ready" / "Cancel"
- Status của cả 2 players

### 4.3 Khi hết giờ
- Auto-cancel nếu chưa ready
- Auto-start nếu cả 2 đã ready

### 4.4 Khi match cancelled
- Navigate về lobby
- Show message: "Opponent left / refused"

---

## Phase 5: Update Navigation & Store

**File:** `src/stores/gameStore.ts`

Thêm:
```typescript
currentMatch: {
  matchId: string;
  opponent: {...};
  status: 'ready' | 'playing';
  myColor: 'white' | 'black';
} | null;
```

**File:** `src/App.tsx`

Thêm route mới hoặc dùng state:
```typescript
/matchmaking -> MatchmakingScreen (searching)
/matchmaking/:matchId -> MatchmakingScreen (ready phase)
```

---

## Phase 6: Game Phase (Simplified)

**File:** `src/services/gameSync.ts`

### 6.1 Auto-create game when both ready
Khi `status: 'playing'`:
1. Tạo game data trong `games/{matchId}`
2. Random color assignment (white/black)
3. Set up board

### 6.2 RTDB Structure
```
/games/{matchId}/
  status: 'playing' | 'finished'
  players: { [userId]: { userId, displayName, color, timeRemaining, capturedPieces } }
  currentTurn: 'white' | 'black'
  board: string[][] (10x10)
  moves: [{ fromRow, fromCol, toRow, toCol, pieceType, color, timestamp }]
  winner?: string
  createdAt: number

/onDisconnect -> auto cleanup
```

### 6.3 MatchScreen Updates
- Subscribe to `games/{matchId}`
- Listen for `status: 'finished'`
- Navigate to result screen

---

## Phase 7: Cleanup on Tab Close

**Files:** `matchmaking.ts`, `gameSync.ts`

Sử dụng `onDisconnect` để:
1. **Matchmaking**: Remove queue entry on disconnect
2. **Game**: Xóa game data on disconnect (hoặc đánh dấu player disconnected)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/matchmaking.ts` | Auto-create match, ready phase logic, cancel |
| `src/services/gameSync.ts` | Auto-create game, cleanup on disconnect |
| `src/stores/gameStore.ts` | Add currentMatch state |
| `src/features/matchmaking/MatchmakingScreen.tsx` | Ready screen UI, timer, status |
| `src/features/match/MatchScreen.tsx` | Subscribe to game updates |
| `src/App.tsx` | Route updates (optional) |

---

## Implementation Order

1. **Phase 1-2**: Update match model, auto-create match when 2 players queue
2. **Phase 3**: Add ready/cancel service methods
3. **Phase 4**: MatchmakingScreen with ready UI
4. **Phase 5**: Store & navigation updates
5. **Phase 6**: Game sync on both ready
6. **Phase 7**: Cleanup on disconnect

---

## Verification

1. Mở 2 tab, login 2 accounts
2. Queue cùng mode → Match auto-created
3. Queue entries bị xóa
4. Ready screen hiện với timer 10s
5. Cả 2 bấm Ready → Game bắt đầu
6. 1 trong 2 không ready → Cancel, về lobby
7. Tắt tab → Game/match bị xóa sau vài giây
