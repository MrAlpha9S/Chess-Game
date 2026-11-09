import { createContext } from 'react';
import type { User } from 'firebase/auth';

/** A card collection saved by the player. */
export interface SavedDeck {
  id: string;
  name: string;
  cards: string[];
  createdAt: Date;
}

/** The player's profile, stored in Firestore under `users/{uid}`. */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  rankClassic: number;
  rankCard: number;
  cardsOwned: string[];
  decks: SavedDeck[];
  createdAt: Date;
  lastLoginAt: Date;
}

/** What the auth context provides. */
export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
