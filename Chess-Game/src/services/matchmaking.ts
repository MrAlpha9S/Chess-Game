import { ref, set, push, onValue, remove, update, onDisconnect, get, type DatabaseReference } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import type { User } from 'firebase/auth';
import { requestGameCreation } from './gameSync';

// Queue entry (trong matchmaking/queue)
export interface MatchmakingEntry {
  userId: string;
  displayName: string;
  photoURL: string | null;
  rank: number;
  gameMode: string;
  timeControl: number;
  timestamp: number;
  status: 'waiting' | 'matched';
}

// Match entry - Dùng cho cả waiting (ready phase) và playing (game data)
export interface MatchEntry {
  id: string;
  players: [
    MatchPlayerInfo,
    MatchPlayerInfo
  ];
  gameMode: string;
  timeControl: number;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled';
  createdAt: number;
  readyStartedAt: number;
  readyDuration: number;
  // Game data (khi status = 'playing' hoặc 'finished')
  currentTurn?: 'white' | 'black';
  board?: string[][];
  moves?: any[];
  winner?: string;
}

export interface MatchPlayerInfo {
  userId: string;
  displayName: string;
  photoURL: string | null;
  rank: number;
  color: 'white' | 'black';
  ready: boolean;
  timeout: boolean;
}

// Match (trong matches/) - SAU KHI BẮT ĐẦU CHƠI
export interface Match {
  id: string;
  players: {
    [playerId: string]: {
      userId: string;
      displayName: string;
      photoURL: string | null;
      rank: number;
      color: 'white' | 'black';
      ready: boolean;
    };
  };
  gameMode: string;
  timeControl: number;
  status: 'ready' | 'playing' | 'finished' | 'cancelled';
  readyStartedAt: number;
  readyDuration: number;
  winner?: string;
  createdAt: number;
}

export interface MatchFoundResult {
  matchId: string;
  opponent: {
    userId: string;
    displayName: string;
    photoURL: string | null;
    rank: number;
    color: 'white' | 'black';
  };
  status: 'waiting' | 'playing';
}

// Matchmaking service
class MatchmakingService {
  private userEntryRef: DatabaseReference | null = null;
  private matchesRef = ref(rtdb, 'matches'); // Dùng chung 1 collection cho cả waiting và playing
  private queueRef = ref(rtdb, 'matchmaking/queue');

  // Store current user info for creating matches
  private currentUserName: string = '';
  private currentUserPhoto: string | null = null;
  private currentUserRank: number = 1200;

  // Track current user to prevent cross-user issues
  private currentUserId: string = '';

  // Prevent concurrent join attempts
  private isJoining: boolean = false;

  // Debug ID for this instance
  private debugId: string = Math.random().toString(36).substring(2, 8);

  constructor() {
    console.log(`[MatchmakingService ${this.debugId}] Created`);
  }

  // Join matchmaking queue
  async joinQueue(user: User, displayName: string, photoURL: string | null, rank: number, gameMode: string, timeControl: number): Promise<void> {
    console.log(`[MatchmakingService ${this.debugId}] joinQueue START for user:`, user.uid);

    if (this.isJoining) {
      console.log(`[MatchmakingService ${this.debugId}] BLOCKED - isJoining is true`);
      return;
    }

    if (this.userEntryRef && this.currentUserId === user.uid) {
      console.log(`[MatchmakingService ${this.debugId}] Already in queue for same user (local):`, user.uid);
      return;
    }

    this.isJoining = true;

    this.currentUserName = displayName;
    this.currentUserPhoto = photoURL;
    this.currentUserRank = rank;
    this.currentUserId = user.uid;

    try {
      const snapshot = await get(this.queueRef);
      const queue = snapshot.val();

      if (queue) {
        for (const [entryId, entry] of Object.entries(queue) as [string, MatchmakingEntry][]) {
          if (entry.userId === user.uid) {
            console.log(`[MatchmakingService ${this.debugId}] Entry already exists in RTDB:`, entryId);
            this.userEntryRef = ref(rtdb, `matchmaking/queue/${entryId}`);
            this.isJoining = false;
            return;
          }
        }
      }
    } catch (err) {
      console.error(`[MatchmakingService ${this.debugId}] Error checking RTDB:`, err);
    }

    const entryRef = push(this.queueRef);
    this.userEntryRef = entryRef;
    console.log(`[MatchmakingService ${this.debugId}] Created new entry with key:`, entryRef.key);

    const entry: MatchmakingEntry = {
      userId: user.uid,
      displayName,
      photoURL,
      rank,
      gameMode,
      timeControl,
      timestamp: Date.now(),
      status: 'waiting',
    };

    try {
      await set(entryRef, entry);
      console.log(`[MatchmakingService ${this.debugId}] SUCCESS - Entry written`);

      onDisconnect(entryRef).remove();
      console.log(`[MatchmakingService ${this.debugId}] Auto-remove on disconnect set`);

      this.isJoining = false;
    } catch (error) {
      console.error(`[MatchmakingService ${this.debugId}] ERROR writing to RTDB:`, error);
      this.userEntryRef = null;
      this.currentUserId = '';
      this.isJoining = false;
      throw error;
    }
  }

  // Get queue reference for listeners
  getQueueRef(): DatabaseReference {
    return this.queueRef;
  }

  // Subscribe to queue updates
  onQueueUpdate(callback: (queue: Record<string, MatchmakingEntry> | null) => void): () => void {
    const unsubscribe = onValue(this.queueRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  }

  // Subscribe to match updates (dùng chung cho waiting và playing)
  onMatchUpdate(matchId: string, callback: (match: MatchEntry | null) => void): () => void {
    console.log(`[MatchmakingService ${this.debugId}] onMatchUpdate called for:`, matchId);
    const matchRef = ref(rtdb, `matches/${matchId}`);
    const unsubscribe = onValue(matchRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  }

  // Subscribe to ALL matches updates (for detecting when user is matched)
  onMatchesUpdate(callback: (matches: Record<string, MatchEntry> | null) => void): () => void {
    const unsubscribe = onValue(this.matchesRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  }

  // Leave matchmaking queue
  async leaveQueue(): Promise<void> {
    console.log(`[MatchmakingService ${this.debugId}] leaveQueue called`);

    if (this.userEntryRef) {
      const keyToRemove = this.userEntryRef.key;
      console.log(`[MatchmakingService ${this.debugId}] Removing entry with key:`, keyToRemove);
      await remove(this.userEntryRef);
      console.log(`[MatchmakingService ${this.debugId}] Entry removed`);
    }

    this.userEntryRef = null;
    this.currentUserId = '';
    this.isJoining = false;
    this.currentUserName = '';
    this.currentUserPhoto = null;
    this.currentUserRank = 1200;
    console.log(`[MatchmakingService ${this.debugId}] State reset`);
  }

  // Check if user already in any active match
  async checkUserInMatch(userId: string): Promise<MatchEntry | null> {
    const snapshot = await get(this.matchesRef);
    const matches = snapshot.val();
    if (!matches) return null;

    for (const [matchId, match] of Object.entries(matches) as [string, MatchEntry][]) {
      if (match.status === 'waiting' || match.status === 'playing') {
        for (const player of match.players) {
          if (player.userId === userId) {
            return { ...match, id: matchId };
          }
        }
      }
    }
    return null;
  }

  // Find opponent and create match
  async findOpponent(userId: string, gameMode: string, timeControl: number): Promise<MatchFoundResult | null> {
    console.log(`[MatchmakingService ${this.debugId}] ===== findOpponent START =====`);
    console.log(`[MatchmakingService ${this.debugId}] My userId:`, userId);

    // 1. Kiểm tra xem user đã có trong match nào chưa
    const existingMatch = await this.checkUserInMatch(userId);
    if (existingMatch) {
      console.log(`[MatchmakingService ${this.debugId}] User already in match:`, existingMatch.id);
      const opponent = existingMatch.players.find(p => p.userId !== userId)!;
      return {
        matchId: existingMatch.id,
        opponent: {
          userId: opponent.userId,
          displayName: opponent.displayName,
          photoURL: opponent.photoURL,
          rank: opponent.rank,
          color: opponent.color,
        },
        status: existingMatch.status as 'waiting' | 'playing',
      };
    }

    // 2. Lấy queue và tìm opponent
    const snapshot = await get(this.queueRef);
    const queue = snapshot.val();
    console.log(`[MatchmakingService ${this.debugId}] Queue snapshot:`, queue);

    if (!queue) {
      console.log(`[MatchmakingService ${this.debugId}] Queue is empty`);
      return null;
    }

    // 3. Tìm opponent phù hợp
    for (const [opponentEntryId, entry] of Object.entries(queue) as [string, MatchmakingEntry][]) {
      if (entry.userId === userId || entry.status !== 'waiting' || entry.gameMode !== gameMode || entry.timeControl !== timeControl) {
        continue;
      }

      console.log(`[MatchmakingService ${this.debugId}] FOUND OPPONENT!`, entry.displayName);

      // 4. KIỂM TRA: opponent đã có match với mình chưa?
      // Nếu opponent đã có match (với mình) → join vào match đó thay vì tạo mới
      const opponentMatch = await this.checkUserInMatch(entry.userId);
      if (opponentMatch) {
        console.log(`[MatchmakingService ${this.debugId}] Opponent already has match, joining...`);

        // Kiểm tra match có chứa mình không
        const myInMatch = opponentMatch.players.find(p => p.userId === userId);
        if (myInMatch) {
          const opponentPlayer = opponentMatch.players.find(p => p.userId !== userId)!;

          // Xóa mình khỏi queue
          if (this.userEntryRef) {
            await remove(this.userEntryRef);
            this.userEntryRef = null;
          }

          // Reset state
          this.currentUserId = '';

          return {
            matchId: opponentMatch.id,
            opponent: {
              userId: opponentPlayer.userId,
              displayName: opponentPlayer.displayName,
              photoURL: opponentPlayer.photoURL,
              rank: opponentPlayer.rank,
              color: opponentPlayer.color,
            },
            status: opponentMatch.status as 'waiting' | 'playing',
          };
        }
      }

      // 5. Random màu quân
      const isFirstPlayerWhite = Math.random() > 0.5;
      const myColor: 'white' | 'black' = isFirstPlayerWhite ? 'white' : 'black';
      const opponentColor: 'white' | 'black' = isFirstPlayerWhite ? 'black' : 'white';

      // 5. Tạo match (dùng push để tạo ID)
      const matchRef = push(this.matchesRef);
      const matchId = matchRef.key!;
      console.log(`[MatchmakingService ${this.debugId}] Creating match with ID:`, matchId);

      const match: MatchEntry = {
        id: matchId,
        players: [
          {
            userId: userId,
            displayName: this.currentUserName,
            photoURL: this.currentUserPhoto,
            rank: this.currentUserRank,
            color: myColor,
            ready: false,
            timeout: false,
          },
          {
            userId: entry.userId,
            displayName: entry.displayName,
            photoURL: entry.photoURL,
            rank: entry.rank,
            color: opponentColor,
            ready: false,
            timeout: false,
          },
        ],
        gameMode,
        timeControl,
        status: 'waiting',
        createdAt: Date.now(),
        readyStartedAt: Date.now(),
        readyDuration: 10,
      };

      // 6. Ghi match vào RTDB
      await set(matchRef, match);
      console.log(`[MatchmakingService ${this.debugId}] Match written to matches/${matchId}`);

      // 7. XÓA CẢ 2 người khỏi QUEUE
      const opponentQueueRef = ref(rtdb, `matchmaking/queue/${opponentEntryId}`);
      await remove(opponentQueueRef);
      console.log(`[MatchmakingService ${this.debugId}] Removed opponent from queue`);

      if (this.userEntryRef) {
        await remove(this.userEntryRef);
        console.log(`[MatchmakingService ${this.debugId}] Removed myself from queue`);
      }

      // 8. Reset state
      this.userEntryRef = null;
      this.currentUserId = '';
      console.log(`[MatchmakingService ${this.debugId}] Match created successfully!`);

      // 9. Trả về thông tin opponent
      return {
        matchId,
        opponent: {
          userId: entry.userId,
          displayName: entry.displayName,
          photoURL: entry.photoURL,
          rank: entry.rank,
          color: opponentColor,
        },
        status: 'waiting',
      };
    }

    console.log(`[MatchmakingService ${this.debugId}] No suitable opponent found`);
    return null;
  }

  // Set player ready
  async setReady(matchId: string, userId: string): Promise<{ bothReady: boolean }> {
    console.log(`[MatchmakingService ${this.debugId}] setReady called:`, { matchId, userId });

    const matchRef = ref(rtdb, `matches/${matchId}`);

    // Đọc match hiện tại
    const snapshot = await get(matchRef);
    const match = snapshot.val() as MatchEntry | null;
    if (!match) {
      console.error(`[MatchmakingService ${this.debugId}] Match not found`);
      return { bothReady: false };
    }

    // Kiểm tra nếu game đã bắt đầu rồi
    if (match.status === 'playing') {
      console.log(`[MatchmakingService ${this.debugId}] Game already started`);
      return { bothReady: true };
    }

    const playerIndex = match.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) {
      console.error(`[MatchmakingService ${this.debugId}] Player not in match`);
      return { bothReady: false };
    }

    // Cập nhật ready = true
    await update(ref(rtdb, `matches/${matchId}/players/${playerIndex}`), {
      ready: true,
    });

    console.log(`[MatchmakingService ${this.debugId}] Ready set successfully`);

    // Đợi một chút để Firebase đồng bộ
    await new Promise(resolve => setTimeout(resolve, 200));

    // Đọc lại match sau khi cập nhật
    const updatedSnapshot = await get(matchRef);
    const updatedMatch = updatedSnapshot.val() as MatchEntry | null;
    if (!updatedMatch) return { bothReady: false };

    // Double-check: nếu game đã bắt đầu rồi thì không làm gì
    if (updatedMatch.status === 'playing') {
      console.log(`[MatchmakingService ${this.debugId}] Game already started (by another player)`);
      return { bothReady: true };
    }

    const bothReady = updatedMatch.players.every(p => p.ready);
    console.log(`[MatchmakingService ${this.debugId}] All players ready:`, bothReady, updatedMatch.players);

    if (bothReady) {
      // CHỉ player có index = 0 HOẶC userId nhỏ hơn mới init game
      const iAmCreator = playerIndex === 0 || userId < updatedMatch.players[1 - playerIndex].userId;

      if (iAmCreator) {
        console.log(`[MatchmakingService ${this.debugId}] I am the creator, starting game...`);

        // Yêu cầu server tạo trạng thái ván authoritative.
        // Server tự bỏ qua nếu ván đã tồn tại, nên gọi lại vô hại.
        await requestGameCreation(matchId);
        console.log(`[MatchmakingService ${this.debugId}] Game started!`);
      } else {
        console.log(`[MatchmakingService ${this.debugId}] Waiting for creator...`);
        // Đợi creator init game
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { bothReady: bothReady };
  }

  // Set timeout
  async setTimeout(matchId: string, userId: string): Promise<{ bothTimeout: boolean }> {
    console.log(`[MatchmakingService ${this.debugId}] setTimeout called:`, { matchId, userId });

    const matchRef = ref(rtdb, `matches/${matchId}`);

    const snapshot = await get(matchRef);
    const match = snapshot.val() as MatchEntry | null;
    if (!match) return { bothTimeout: false };

    const playerIndex = match.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) return { bothTimeout: false };

    await update(ref(rtdb, `matches/${matchId}/players/${playerIndex}`), {
      timeout: true,
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const updatedSnapshot = await get(matchRef);
    const updatedMatch = updatedSnapshot.val() as MatchEntry | null;
    if (!updatedMatch) return { bothTimeout: false };

    const bothTimeout = updatedMatch.players.every(p => p.timeout);
    console.log(`[MatchmakingService ${this.debugId}] All players timeout:`, bothTimeout);

    if (bothTimeout) {
      await update(matchRef, { status: 'cancelled' });
    }

    return { bothTimeout: bothTimeout };
  }

  // Cancel match
  async cancelMatch(matchId: string): Promise<void> {
    console.log(`[MatchmakingService ${this.debugId}] cancelMatch called:`, matchId);
    await update(ref(rtdb, `matches/${matchId}`), {
      status: 'cancelled',
    });
  }

  // Get match by ID
  async getMatch(matchId: string): Promise<MatchEntry | null> {
    const snapshot = await get(ref(rtdb, `matches/${matchId}`));
    return snapshot.val();
  }

  // Delete match
  async deleteMatch(matchId: string): Promise<void> {
    console.log(`[MatchmakingService ${this.debugId}] deleteMatch:`, matchId);
    await remove(ref(rtdb, `matches/${matchId}`));
  }

  // Leave match
  async leaveMatch(matchId: string, userId: string): Promise<void> {
    console.log(`[MatchmakingService ${this.debugId}] leaveMatch:`, { matchId, userId });
    await this.cancelMatch(matchId);
  }
}

export const matchmakingService = new MatchmakingService();
