import type { Card, Player, MatchState, Piece } from '../types';

// Card data for the game (41 cards)
export const allCards: Card[] = [
  // Gold cards
  { id: 'gold-1', name: 'Golden Knight', color: 'gold', description: 'Move as a knight 3 times', value: 2 },
  { id: 'gold-2', name: 'Golden Bishop', color: 'gold', description: 'Swap with any piece', value: 2 },
  { id: 'gold-3', name: 'Golden Rook', color: 'gold', description: 'Move like a rook infinitely', value: 2 },
  { id: 'gold-4', name: 'Golden Queen', color: 'gold', description: 'Queen\'s movement + capture', value: 3 },
  { id: 'gold-5', name: 'Golden Pawn', color: 'gold', description: 'Move 2 squares forward', value: 1 },
  { id: 'gold-6', name: 'Golden Shield', color: 'gold', description: 'Block next attack', value: 1 },
  { id: 'gold-7', name: 'Golden Strike', color: 'gold', description: 'Capture adjacent enemy', value: 2 },

  // Silver cards
  { id: 'silver-1', name: 'Silver Scout', color: 'silver', description: 'Move 3 squares any direction', value: 2 },
  { id: 'silver-2', name: 'Silver Mirror', color: 'silver', description: 'Copy opponent\'s last move', value: 2 },
  { id: 'silver-3', name: 'Silver Swap', color: 'silver', description: 'Swap positions with any piece', value: 1 },
  { id: 'silver-4', name: 'Silver Dash', color: 'silver', description: 'Move through pieces', value: 2 },
  { id: 'silver-5', name: 'Silver Leap', color: 'silver', description: 'Jump to any empty square', value: 2 },
  { id: 'silver-6', name: 'Silver Block', color: 'silver', description: 'Prevent one capture', value: 1 },
  { id: 'silver-7', name: 'Silver Push', color: 'silver', description: 'Push adjacent piece', value: 1 },

  // Green cards
  { id: 'green-1', name: 'Green Fortress', color: 'green', description: 'Add +3 squares to home territory', value: 3, clockThreshold: 300 },
  { id: 'green-2', name: 'Green Wall', color: 'green', description: 'Add +1 square to home territory', value: 2, clockThreshold: 300 },
  { id: 'green-3', name: 'Green Expansion', color: 'green', description: 'Expand board by 1 row', value: 3, clockThreshold: 240 },
  { id: 'green-4', name: 'Green Barrier', color: 'green', description: 'Create impassable square', value: 2, clockThreshold: 300 },
  { id: 'green-5', name: 'Green Healing', color: 'green', description: 'Restore 30 seconds', value: 1, clockThreshold: 180 },

  // Blue cards
  { id: 'blue-1', name: 'Blue Teleport', color: 'blue', description: 'Move any piece anywhere', value: 3 },
  { id: 'blue-2', name: 'Blue Clone', color: 'blue', description: 'Create copy of a piece', value: 3 },
  { id: 'blue-3', name: 'Blue Freeze', color: 'blue', description: 'Freeze one enemy piece', value: 2 },
  { id: 'blue-4', name: 'Blue Paralyze', color: 'blue', description: 'Disable one enemy piece', value: 2 },
  { id: 'blue-5', name: 'Blue Petra', color: 'blue', description: 'Petrify one enemy piece', value: 3 },
  { id: 'blue-6', name: 'Blue Reveal', color: 'blue', description: 'Reveal hidden pieces', value: 2 },
  { id: 'blue-7', name: 'Blue Trap', color: 'blue', description: 'Lock enemy card', value: 2 },

  // Bronze cards
  { id: 'bronze-1', name: 'Bronze Spawn', color: 'bronze', description: 'Add a pawn to board', value: 1 },
  { id: 'bronze-2', name: 'Bronze Upgrade', color: 'bronze', description: 'Upgrade one pawn', value: 2 },
  { id: 'bronze-3', name: 'Bronze Support', color: 'bronze', description: 'Heal one piece +1', value: 1 },
  { id: 'bronze-4', name: 'Bronze Shield', color: 'bronze', description: 'Armor one piece', value: 1 },
  { id: 'bronze-5', name: 'Bronze Sentry', color: 'bronze', description: 'Add trap to square', value: 1 },
  { id: 'bronze-6', name: 'Bronze Recall', color: 'bronze', description: 'Return piece to start', value: 1 },
  { id: 'bronze-7', name: 'Bronze Scout', color: 'bronze', description: 'Preview enemy move', value: 1 },

  // Purple cards
  { id: 'purple-1', name: 'Purple Curse', color: 'purple', description: 'Weaken enemy king', value: 3 },
  { id: 'purple-2', name: 'Purple Drain', color: 'purple', description: 'Steal 30 seconds', value: 2 },
  { id: 'purple-3', name: 'Purple Shadow', color: 'purple', description: 'Make piece invisible', value: 3 },
  { id: 'purple-4', name: 'Purple Chaos', color: 'purple', description: 'Random board shuffle', value: 2 },
  { id: 'purple-5', name: 'Purple Time', color: 'purple', description: 'Reverse 10 seconds', value: 2 },
  { id: 'purple-6', name: 'Purple Void', color: 'purple', description: 'Remove one piece', value: 3 },
  { id: 'purple-7', name: 'Purple Mind', color: 'purple', description: 'Control enemy piece', value: 3 },

  // Extra cards to reach 41
  { id: 'gold-8', name: 'Golden Champion', color: 'gold', description: 'Double move this turn', value: 2 },
  { id: 'silver-8', name: 'Silver Wind', color: 'silver', description: 'Move all pieces one step', value: 2 },
];

// Get cards by color
export const getCardsByColor = (color: Card['color']) => allCards.filter(c => c.color === color);

// Initial deck for player (can be modified)
export const createDeck = (cards: Card[]): Card[] => {
  if (cards.length !== 3) {
    throw new Error('Deck must have exactly 3 cards');
  }
  const colors = cards.map(c => c.color);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size !== 3) {
    throw new Error('Deck must have 3 different colors');
  }
  const totalValue = cards.reduce((sum, c) => sum + c.value, 0);
  if (totalValue > 9) {
    throw new Error('Total deck value must not exceed 9');
  }
  return cards;
};

// Mock current user
export const mockCurrentUser: Player = {
  id: 'user-1',
  name: 'Player123',
  rank: 1200,
  timeRemaining: 300,
  capturedPieces: [],
  hand: [allCards[0], allCards[8], allCards[15]], // Gold, Silver, Green
  isActive: true,
};

// Mock opponent
export const mockOpponent: Player = {
  id: 'user-2',
  name: 'ChessMaster',
  rank: 1150,
  timeRemaining: 295,
  capturedPieces: [],
  hand: [allCards[1], allCards[9], allCards[16]], // Gold, Silver, Green
  isActive: false,
};

// Create initial chess board setup
const createInitialBoard = (): MatchState['board'] => {
  const squares: MatchState['board']['squares'] = [];

  for (let row = 0; row < 10; row++) {
    const rowSquares = [];
    for (let col = 0; col < 10; col++) {
      // Only 8x8 area is active (rows 2-9, cols 0-7)
      const isActiveArea = row >= 2 && row <= 9 && col >= 0 && col <= 7;
      const activeRow = row - 2; // 0-7 for display
      const activeCol = col; // 0-7 for display

      let piece: Piece | null = null;

      if (isActiveArea) {
        // Black pieces (row 2 = index 0)
        if (activeRow === 0) {
          if (activeCol === 0) piece = { type: 'rook', color: 'black', id: 'br1' };
          else if (activeCol === 1) piece = { type: 'knight', color: 'black', id: 'bn1' };
          else if (activeCol === 2) piece = { type: 'bishop', color: 'black', id: 'bb1' };
          else if (activeCol === 3) piece = { type: 'queen', color: 'black', id: 'bq' };
          else if (activeCol === 4) piece = { type: 'king', color: 'black', id: 'bk', isRoyal: true };
          else if (activeCol === 5) piece = { type: 'bishop', color: 'black', id: 'bb2' };
          else if (activeCol === 6) piece = { type: 'knight', color: 'black', id: 'bn2' };
          else if (activeCol === 7) piece = { type: 'rook', color: 'black', id: 'br2' };
        }
        // Black pawns (row 3 = index 1)
        else if (activeRow === 1) {
          piece = { type: 'pawn', color: 'black', id: `bp${activeCol + 1}` };
        }
        // White pawns (row 6 = index 6)
        else if (activeRow === 6) {
          piece = { type: 'pawn', color: 'white', id: `wp${activeCol + 1}` };
        }
        // White pieces (row 7 = index 7)
        else if (activeRow === 7) {
          if (activeCol === 0) piece = { type: 'rook', color: 'white', id: 'wr1' };
          else if (activeCol === 1) piece = { type: 'knight', color: 'white', id: 'wn1' };
          else if (activeCol === 2) piece = { type: 'bishop', color: 'white', id: 'wb1' };
          else if (activeCol === 3) piece = { type: 'queen', color: 'white', id: 'wq' };
          else if (activeCol === 4) piece = { type: 'king', color: 'white', id: 'wk', isRoyal: true };
          else if (activeCol === 5) piece = { type: 'bishop', color: 'white', id: 'wb2' };
          else if (activeCol === 6) piece = { type: 'knight', color: 'white', id: 'wn2' };
          else if (activeCol === 7) piece = { type: 'rook', color: 'white', id: 'wr2' };
        }
      }

      rowSquares.push({
        position: {
          file: ('abcdefgh'[activeCol] as any) || 'a',
          rank: (8 - activeRow) as any,
        },
        piece,
        isActive: isActiveArea,
      });
    }
    squares.push(rowSquares);
  }

  return {
    squares,
    activeBoardSize: 8,
    offsetRow: 2,
    offsetCol: 0,
  };
};

// Mock match state
export const mockMatchState: MatchState = {
  id: 'match-1',
  mode: 'card-casual',
  status: 'playing',
  board: createInitialBoard(),
  players: [mockCurrentUser, mockOpponent],
  currentTurn: 'white',
  moves: [],
  cardActions: [],
  result: null,
  timeControl: {
    initial: 300,
    increment: 10,
  },
};

// Mock matchmaking state
export const mockMatchmakingState = {
  progress: 60,
  waitingTime: 42,
  isSearching: true,
};

// Mock result state
export const mockResultState = {
  result: 'win' as const,
  eloChange: 15,
  newRank: 1215,
  oldRank: 1200,
  duration: 272, // 4:32
  moveCount: 24,
  cardsUsed: 2,
  totalCards: 3,
};
