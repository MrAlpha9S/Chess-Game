import { create } from 'zustand';

/** The time controls a room can be created with, in milliseconds. */
export const TIME_CONTROLS = [
  { label: '3+0', initialMs: 3 * 60 * 1000, incrementMs: 0 },
  { label: '5+0', initialMs: 5 * 60 * 1000, incrementMs: 0 },
  { label: '10+0', initialMs: 10 * 60 * 1000, incrementMs: 0 },
  { label: '15+10', initialMs: 15 * 60 * 1000, incrementMs: 10 * 1000 },
  { label: '30+0', initialMs: 30 * 60 * 1000, incrementMs: 0 },
] as const;

interface GameStore {
  /** The time control the player has chosen in the lobby. */
  selectedTimeControlMs: number;
  /** The increment that goes with the chosen time control. */
  selectedIncrementMs: number;
  /** Choose a time control. */
  setTimeControl: (initialMs: number, incrementMs: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  selectedTimeControlMs: 10 * 60 * 1000,
  selectedIncrementMs: 0,
  setTimeControl: (initialMs, incrementMs) =>
    set({ selectedTimeControlMs: initialMs, selectedIncrementMs: incrementMs }),
}));
