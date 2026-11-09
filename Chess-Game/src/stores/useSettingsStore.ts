import { create } from 'zustand';
import { setSoundEnabled as setAudioEnabled } from '../lib/audio';

interface SettingsStore {
  /** True when the game plays sounds. */
  soundEnabled: boolean;
  /** True when the board tilts with the pointer. */
  pointerFieldEnabled: boolean;
  /** Turn sound on or off. */
  setSoundEnabled: (enabled: boolean) => void;
  /** Turn the pointer effect on or off. */
  setPointerFieldEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  soundEnabled: true,
  pointerFieldEnabled: true,
  setSoundEnabled: (enabled) => {
    setAudioEnabled(enabled);
    set({ soundEnabled: enabled });
  },
  setPointerFieldEnabled: (enabled) => set({ pointerFieldEnabled: enabled }),
}));
