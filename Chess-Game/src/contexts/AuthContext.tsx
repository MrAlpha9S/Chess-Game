import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, facebookProvider } from '../lib/firebase';
import type { User } from 'firebase/auth';
import { AuthContext, type AuthContextType, type UserProfile } from './authContextDefinition';

export type { SavedDeck, UserProfile } from './authContextDefinition';
export { AuthContext } from './authContextDefinition';

/**
 * A Firebase auth error.
 *
 * The Firebase SDK throws plain errors carrying a `code` such as
 * 'auth/popup-closed-by-user', so the code is read through this shape.
 */
interface FirebaseAuthError {
  code?: string;
  message?: string;
}

/** Narrow a caught value to a Firebase auth error. */
function asAuthError(err: unknown): FirebaseAuthError {
  if (typeof err === 'object' && err !== null) {
    return err as FirebaseAuthError;
  }
  return { message: typeof err === 'string' ? err : undefined };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load or create user profile in Firestore
  const loadOrCreateProfile = async (firebaseUser: User) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);

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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          await loadOrCreateProfile(firebaseUser);
        } catch (err: unknown) {
          const authError = asAuthError(err);
          console.error('Error loading profile:', err);
          setError(
            'Failed to load user profile: ' +
              (authError.message || authError.code || 'Unknown error'),
          );
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with Google (popup method)
  const signInWithGoogle = async () => {
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      await loadOrCreateProfile(result.user);
    } catch (err: unknown) {
      const authError = asAuthError(err);
      console.error('Sign in error:', err);
      console.error('Error code:', authError.code);
      console.error('Error message:', authError.message);

      if (authError.code === 'auth/popup-closed-by-user') {
        setError('Sign in cancelled');
      } else if (authError.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email');
      } else if (authError.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Add localhost to Firebase authorized domains.');
      } else {
        setError('Failed to sign in: ' + (authError.message || authError.code));
      }

      throw err;
    }
  };

  // Sign in with Facebook (popup method)
  const signInWithFacebook = async () => {
    setError(null);

    try {
      const result = await signInWithPopup(auth, facebookProvider);
      setUser(result.user);
      await loadOrCreateProfile(result.user);
    } catch (err: unknown) {
      const authError = asAuthError(err);
      console.error('Facebook sign in error:', err);
      console.error('Error code:', authError.code);
      console.error('Error message:', authError.message);

      if (authError.code === 'auth/popup-closed-by-user') {
        setError('Sign in cancelled');
      } else if (authError.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email');
      } else if (authError.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Add localhost to Firebase authorized domains.');
      } else {
        setError('Failed to sign in: ' + (authError.message || authError.code));
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
    } catch (err: unknown) {
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

