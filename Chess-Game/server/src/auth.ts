/**
 * Authentication: verify the Firebase ID token the client presents.
 *
 * The client sends the ID token in the `Authorization: Bearer <token>`
 * header (the Firebase SDK stores it on the user, so this is the standard
 * way to bridge Firebase Auth to a custom backend). We verify the signature
 * and expiry, and extract the uid - the single identity the whole service
 * trusts.
 */

import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import type { Config } from './config';

export interface AuthContext {
  uid: string;
}

/**
 * Extract and verify the Firebase ID token from a request.
 *
 * Returns the uid when the token is valid. For endpoints that do not need
 * an authenticated user (the game is shared between its two players), a
 * malformed or missing token is still accepted as anonymous - the game
 * service enforces that the caller is one of the two players anyway.
 */
export async function authenticate(
  config: Config,
  authorizationHeader: string | undefined,
): Promise<AuthContext> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    // Unauthenticated. Callers that need a specific uid will fail the
    // game-service check ("it is not your turn" / unknown color).
    return { uid: '' };
  }

  try {
    const auth = getAuth(getApps()[0] ?? initializeApp({ projectId: config.projectId }));
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    // A token that does not verify must not be treated as a valid identity.
    return { uid: '' };
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? undefined;
}
