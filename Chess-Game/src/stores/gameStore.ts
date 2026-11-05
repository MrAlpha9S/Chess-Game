import { create } from 'zustand';
import type { Screen, GameMode, MatchState, Card, Position } from '../types';
import { allCards } from '../data/cards';

interface GameStore {
  // Navigation
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;

  // Game mode selection
  selectedMode: GameMode;
  selectedTimeControl: number;
  setSelectedMode: (mode: GameMode) => void;
  setSelectedTimeControl: (time: number) => void;

  // Match state
  matchState: MatchState | null;
  setMatchState: (state: MatchState | null) => void;
  updateMatchState: (updates: Partial<MatchState>) => void;

  // Online match info
  currentMatchId: string | null;
  opponentInfo: { userId: string; displayName: string; photoURL: string | null; rank: number } | null;
  setMatchInfo: (matchId: string | null, opponent: { userId: string; displayName: string; photoURL: string | null; rank: number } | null) => void;

  // Board interaction
  selectedPiece: Position | null;
  setSelectedPiece: (pos: Position | null) => void;
  validMoves: Position[];
  setValidMoves: (moves: Position[]) => void;

  // Deck building
  playerDeck: Card[];
  playerCollection: Card[];
  setPlayerDeck: (deck: Card[]) => void;
  addToDeck: (card: Card) => void;
  removeFromDeck: (cardId: string) => void;

  // Preparation phase
  lockedCards: Card[];
  setLockedCards: (cards: Card[]) => void;
  selectedGoldPiece: Position | null;
  setSelectedGoldPiece: (pos: Position | null) => void;
  selectedSilverPiece: Position | null;
  setSelectedSilverPiece: (pos: Position | null) => void;
  placedBronzePos: Position | null;
  setPlacedBronzePos: (pos: Position | null) => void;

  // Matchmaking
  isSearching: boolean;
  searchProgress: number;
  searchWaitingTime: number;
  startSearching: () => void;
  cancelSearching: () => void;
  updateSearchProgress: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Navigation
  currentScreen: 'login',
  setScreen: (screen) => set({ currentScreen: screen }),

  // Game mode selection
  selectedMode: 'card-casual',
  selectedTimeControl: 300,
  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setSelectedTimeControl: (time) => set({ selectedTimeControl: time }),

  // Match state
  matchState: null,
  setMatchState: (state) => set({ matchState: state }),
  updateMatchState: (updates) => set((state) => ({
    matchState: state.matchState ? { ...state.matchState, ...updates } : null,
  })),

  // Online match info
  currentMatchId: null,
  opponentInfo: null,
  setMatchInfo: (matchId, opponent) => set({ currentMatchId: matchId, opponentInfo: opponent }),

  // Board interaction
  selectedPiece: null,
  setSelectedPiece: (pos) => set({ selectedPiece: pos }),
  validMoves: [],
  setValidMoves: (moves) => set({ validMoves: moves }),

  // Deck building
  playerDeck: [allCards[0], allCards[8], allCards[15]], // Default deck
  playerCollection: allCards,
  setPlayerDeck: (deck) => set({ playerDeck: deck }),
  addToDeck: (card) => {
    const { playerDeck } = get();
    if (playerDeck.length < 3) {
      const colors = [...playerDeck.map(c => c.color), card.color];
      const uniqueColors = new Set(colors);
      if (uniqueColors.size === colors.length) {
        set({ playerDeck: [...playerDeck, card] });
      }
    }
  },
  removeFromDeck: (cardId) => {
    const { playerDeck } = get();
    set({ playerDeck: playerDeck.filter(c => c.id !== cardId) });
  },

  // Preparation phase
  lockedCards: [],
  setLockedCards: (cards) => set({ lockedCards: cards }),
  selectedGoldPiece: null,
  setSelectedGoldPiece: (pos) => set({ selectedGoldPiece: pos }),
  selectedSilverPiece: null,
  setSelectedSilverPiece: (pos) => set({ selectedSilverPiece: pos }),
  placedBronzePos: null,
  setPlacedBronzePos: (pos) => set({ placedBronzePos: pos }),

  // Matchmaking
  isSearching: false,
  searchProgress: 0,
  searchWaitingTime: 0,
  startSearching: () => set({
    isSearching: true,
    searchProgress: 0,
    searchWaitingTime: 0,
  }),
  cancelSearching: () => set({
    isSearching: false,
    searchProgress: 0,
    searchWaitingTime: 0,
  }),
  updateSearchProgress: () => {
    const { searchProgress, searchWaitingTime } = get();
    if (searchProgress < 100) {
      set({
        searchProgress: Math.min(searchProgress + 2, 100),
        searchWaitingTime: searchWaitingTime + 1,
      });
    }
  },
}));

// Settings store for audio and motion preferences
interface SettingsStore {
  soundEnabled: boolean;
  masterVolume: number;
  pieceVolume: number;
  cardVolume: number;
  uiVolume: number;
  reducedMotion: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setPieceVolume: (volume: number) => void;
  setCardVolume: (volume: number) => void;
  setUiVolume: (volume: number) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  soundEnabled: true,
  masterVolume: 80,
  pieceVolume: 100,
  cardVolume: 100,
  uiVolume: 50,
  reducedMotion: false,
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setPieceVolume: (volume) => set({ pieceVolume: volume }),
  setCardVolume: (volume) => set({ cardVolume: volume }),
  setUiVolume: (volume) => set({ uiVolume: volume }),
  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
}));
