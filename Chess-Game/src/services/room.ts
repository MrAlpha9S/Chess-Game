import { ref, set, get, update, remove, onValue } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { type User } from 'firebase/auth';

// Room data structure
export interface RoomPlayer {
  userId: string;
  displayName: string;
  photoURL: string | null;
  rank: number;
  color: 'white' | 'black';
  ready: boolean;
}

export interface Room {
  id: string;
  gameMode: string;
  timeControl: number;
  hostId: string;
  hostName: string;
  players: [RoomPlayer, RoomPlayer | null]; // host + guest
  status: 'waiting' | 'ready' | 'playing' | 'cancelled';
  createdAt: number;
  // Game data (when playing)
  board?: string[][];
  currentTurn?: 'white' | 'black';
  moves?: any[];
}

// Generate 6-char room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Room service
class RoomService {
  private debugId = Math.random().toString(36).substring(2, 8);

  // Create a new room
  async createRoom(
    user: User,
    displayName: string,
    photoURL: string | null,
    rank: number,
    gameMode: string,
    timeControl: number
  ): Promise<Room | null> {
    console.log(`[RoomService ${this.debugId}] Creating room...`);

    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;

    // Ensure unique code
    while (attempts < 10) {
      const snapshot = await get(ref(rtdb, `matchmaking/rooms/${roomCode}`));
      if (!snapshot.exists()) break;
      roomCode = generateRoomCode();
      attempts++;
    }

    if (attempts >= 10) {
      console.error('Failed to generate unique room code');
      return null;
    }

    const hostColor: 'white' | 'black' = Math.random() > 0.5 ? 'white' : 'black';

    const room: Room = {
      id: roomCode,
      gameMode,
      timeControl,
      hostId: user.uid,
      hostName: displayName,
      players: [
        {
          userId: user.uid,
          displayName,
          photoURL,
          rank,
          color: hostColor,
          ready: false,
        },
        null as any, // guest slot empty
      ],
      status: 'waiting',
      createdAt: Date.now(),
    };

    await set(ref(rtdb, `matchmaking/rooms/${roomCode}`), room);
    console.log(`[RoomService ${this.debugId}] Room created:`, roomCode);

    // Auto-cleanup after 10 minutes
    setTimeout(async () => {
      const roomSnapshot = await get(ref(rtdb, `matchmaking/rooms/${roomCode}`));
      if (roomSnapshot.val()?.status === 'waiting') {
        await this.deleteRoom(roomCode);
      }
    }, 10 * 60 * 1000);

    return room;
  }

  // Join an existing room
  async joinRoom(
    roomCode: string,
    user: User,
    displayName: string,
    photoURL: string | null,
    rank: number
  ): Promise<Room | null> {
    console.log(`[RoomService ${this.debugId}] Joining room:`, roomCode);

    const roomSnapshot = await get(ref(rtdb, `matchmaking/rooms/${roomCode}`));
    const room = roomSnapshot.val() as Room | null;

    if (!room) {
      console.error('Room not found');
      return null;
    }

    if (room.status !== 'waiting') {
      console.error('Room not available');
      return null;
    }

    if (room.hostId === user.uid) {
      console.error('Cannot join your own room');
      return null;
    }

    if (room.players[1]) {
      console.error('Room is full');
      return null;
    }

    // Guest color is opposite of host
    const guestColor: 'white' | 'black' = room.players[0].color === 'white' ? 'black' : 'white';

    const guestPlayer: RoomPlayer = {
      userId: user.uid,
      displayName,
      photoURL,
      rank,
      color: guestColor,
      ready: false,
    };

    await update(ref(rtdb, `matchmaking/rooms/${roomCode}/players`), {
      1: guestPlayer,
    });

    console.log(`[RoomService ${this.debugId}] Joined room successfully`);

    return { ...room, players: [room.players[0], guestPlayer] };
  }

  // Leave a room
  async leaveRoom(roomCode: string, userId: string): Promise<void> {
    console.log(`[RoomService ${this.debugId}] Leaving room:`, roomCode);

    const roomSnapshot = await get(ref(rtdb, `matchmaking/rooms/${roomCode}`));
    const room = roomSnapshot.val() as Room | null;

    if (!room) return;

    // If host leaves, delete the room
    if (room.hostId === userId) {
      await this.deleteRoom(roomCode);
    } else {
      // Otherwise just remove guest
      await update(ref(rtdb, `matchmaking/rooms/${roomCode}/players`), {
        1: null,
      });
    }
  }

  // Set player ready
  async setReady(roomCode: string, userId: string, ready: boolean): Promise<{ bothReady: boolean }> {
    console.log(`[RoomService ${this.debugId}] setReady:`, { roomCode, userId, ready });

    const roomRef = ref(rtdb, `matchmaking/rooms/${roomCode}`);
    const snapshot = await get(roomRef);
    const room = snapshot.val() as Room | null;

    if (!room) return { bothReady: false };

    const playerIndex = room.players.findIndex(p => p && p.userId === userId);
    if (playerIndex === -1) return { bothReady: false };

    await update(ref(rtdb, `matchmaking/rooms/${roomCode}/players/${playerIndex}`), {
      ready,
    });

    // Check if both ready
    const updatedSnapshot = await get(roomRef);
    const updatedRoom = updatedSnapshot.val() as Room | null;

    if (!updatedRoom) return { bothReady: false };

    const player0 = updatedRoom.players[0];
    const player1 = updatedRoom.players[1];
    const bothReady = !!(player0?.ready && player1?.ready);

    if (bothReady) {
      console.log(`[RoomService ${this.debugId}] Both ready! Starting game...`);
      await this.startGame(roomCode);
    }

    return { bothReady };
  }

  // Start game
  async startGame(roomCode: string): Promise<void> {
    console.log(`[RoomService ${this.debugId}] Starting game...`);

    // Create initial board
    const board = this.createInitialBoard();

    await update(ref(rtdb, `matchmaking/rooms/${roomCode}`), {
      status: 'playing',
      board,
      currentTurn: 'white',
      moves: [],
    });
  }

  // Create initial board
  private createInitialBoard(): string[][] {
    const board: string[][] = Array(10).fill(null).map(() => Array(10).fill(''));

    // Black pieces (top)
    board[2] = ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br', '', ''];
    board[3] = ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', '', ''];

    // White pieces (bottom) - same columns 0-7 as black, rank 2 and rank 1
    board[8] = ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', '', ''];
    board[9] = ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr', '', ''];

    return board;
  }

  // Delete room
  async deleteRoom(roomCode: string): Promise<void> {
    console.log(`[RoomService ${this.debugId}] Deleting room:`, roomCode);
    await remove(ref(rtdb, `matchmaking/rooms/${roomCode}`));
  }

  // Subscribe to room updates
  subscribeToRoom(roomCode: string, callback: (room: Room | null) => void): () => void {
    console.log(`[RoomService ${this.debugId}] Subscribing to room:`, roomCode);

    const unsubscribe = onValue(ref(rtdb, `matchmaking/rooms/${roomCode}`), (snapshot) => {
      callback(snapshot.val());
    });

    return unsubscribe;
  }

  // Get room by code
  async getRoom(roomCode: string): Promise<Room | null> {
    const snapshot = await get(ref(rtdb, `matchmaking/rooms/${roomCode}`));
    return snapshot.val();
  }

  // Update game state (for moves, etc)
  async updateGameState(roomCode: string, updates: Partial<Room>): Promise<void> {
    await update(ref(rtdb, `matchmaking/rooms/${roomCode}`), updates);
  }
}

export const roomService = new RoomService();
