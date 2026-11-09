import { useContext } from 'react';
import { AuthContext } from './authContextDefinition';

/**
 * The signed-in player and their profile.
 *
 * Throws when used outside an `AuthProvider`, which is always a mistake in
 * the component tree.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
