import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, facebookProvider } from '../lib/firebase';
import type { User } from 'firebase/auth';

// User profile type
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

export interface SavedDeck {
  id: string;
  name: string;
  cards: string[]; // card IDs
  createdAt: Date;
}

// Auth Context
interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    console.log('Auth state listener mounted');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email || 'null');
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          console.log('Loading profile for:', firebaseUser.uid);
          await loadOrCreateProfile(firebaseUser);
          console.log('Profile loaded successfully');
        } catch (err: any) {
          console.error('Error loading profile:', err);
          console.error('Error code:', err.code);
          console.error('Error message:', err.message);
          setError('Failed to load user profile: ' + (err.message || err.code || 'Unknown error'));
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load or create user profile in Firestore
  const loadOrCreateProfile = async (firebaseUser: User) => {
    console.log('loadOrCreateProfile called for:', firebaseUser.uid);
    const userRef = doc(db, 'users', firebaseUser.uid);
    console.log('Fetching user doc...');
    const userDoc = await getDoc(userRef);
    console.log('User doc exists:', userDoc.exists());

    if (userDoc.exists()) {
      // Load existing profile
      const data = userDoc.data();
      setProfile({
        uid: firebaseUser.uid,
        displayName: data.displayName || firebaseUser.displayName || 'Player',
        email: data.email || firebaseUser.email,
        photoURL: data.photoURL || firebaseUser.photoURL,
        rankClassic: data.rankClassic || 1200,
        rankCard: data.rankCard || 1200,
        cardsOwned: data.cardsOwned || [],
        decks: data.decks || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
      });

      // Update last login
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    } else {
      // Create new profile
      const newProfile: Omit<UserProfile, 'uid'> & { uid?: string } = {
        displayName: firebaseUser.displayName || 'Player',
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        rankClassic: 1200,
        rankCard: 1200,
        cardsOwned: [], // All cards unlocked for demo
        decks: [],
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      await setDoc(userRef, {
        ...newProfile,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      setProfile({
        uid: firebaseUser.uid,
        ...newProfile,
      });
    }
  };


  // Sign in with Google (popup method)
  const signInWithGoogle = async () => {
    setError(null);
    console.log('Starting Google sign in...');

    try {
      console.log('Calling signInWithPopup...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('signInWithPopup completed:', result.user.email);
      setUser(result.user);
      await loadOrCreateProfile(result.user);
    } catch (err: any) {
      console.error('Sign in error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in cancelled');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Add localhost to Firebase authorized domains.');
      } else {
        setError('Failed to sign in: ' + (err.message || err.code));
      }

      throw err;
    }
  };

  // Sign in with Facebook (popup method)
  const signInWithFacebook = async () => {
    setError(null);
    console.log('Starting Facebook sign in...');

    try {
      console.log('Calling signInWithPopup for Facebook...');
      const result = await signInWithPopup(auth, facebookProvider);
      console.log('Facebook sign in completed:', result.user.email);
      setUser(result.user);
      await loadOrCreateProfile(result.user);
    } catch (err: any) {
      console.error('Facebook sign in error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in cancelled');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Add localhost to Firebase authorized domains.');
      } else {
        setError('Failed to sign in: ' + (err.message || err.code));
      }

      throw err;
    }
  };

  // Sign out
  const signOutUser = async () => {
    setError(null);

    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError('Failed to sign out');
      throw err;
    }
  };

  // Update profile in Firestore
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userRef = doc(db, 'users', user.uid);
    const updatesToSave = { ...updates };

    // Remove fields that shouldn't be saved directly
    delete updatesToSave.uid;
    delete updatesToSave.createdAt;

    await setDoc(userRef, updatesToSave, { merge: true });

    // Update local state
    setProfile((prev) => prev ? { ...prev, ...updates } : null);
  };

  // Refresh profile from Firestore
  const refreshProfile = async () => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      setProfile({
        uid: user.uid,
        displayName: data.displayName || 'Player',
        email: data.email || null,
        photoURL: data.photoURL || null,
        rankClassic: data.rankClassic || 1200,
        rankCard: data.rankCard || 1200,
        cardsOwned: data.cardsOwned || [],
        decks: data.decks || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
      });
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    error,
    signInWithGoogle,
    signInWithFacebook,
    signOutUser,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
