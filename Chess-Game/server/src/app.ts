/**
 * The HTTP API.
 *
 * Three endpoints, all of which mutate or read the authoritative game state:
 *
 *   POST /api/match/:matchId/game       create the game state
 *   POST /api/match/:matchId/move       submit a move for validation
 *   POST /api/match/:matchId/end        resign or agree a draw
 *
 * Plus a health check. The move validation itself lives in
 * `@chess-game/game-service` and is shared with the Cloud Functions
 * implementation, so both enforce exactly the same rules.
 */

import express, { type Express, type Request, type Response } from 'express';
import { GameError, GameService } from '@chess-game/game-service';
import { authenticate, type AuthContext } from './auth';
import type { Config } from './config';

export interface ApiDeps {
  config: Config;
  service: GameService;
  /**
   * Resolves the caller identity from the request. Overridable so the tests
   * can exercise the API without a Firebase project.
   */
  resolveAuth?: (
    config: Config,
    authorizationHeader: string | undefined,
  ) => Promise<AuthContext>;
}

export function createApp({ config, service, resolveAuth = authenticate }: ApiDeps): Express {
  const app = express();

  app.use(express.json({ limit: '64kb' }));

  // CORS: the web client is served from Firebase Hosting, so its origin
  // differs from this API's.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, projectId: config.projectId });
  });

  // Create the authoritative game state for a match.
  app.post('/api/match/:matchId/game', async (req: Request, res: Response) => {
    const { uid } = await resolveAuth(config, req.headers.authorization);
    if (!uid) {
      res.status(401).json({ error: 'unauthenticated', message: 'Sign in to play.' });
      return;
    }
    await handle(res, () => service.createGame(req.params.matchId));
  });

  // Submit a move for validation.
  app.post('/api/match/:matchId/move', async (req: Request, res: Response) => {
    const { uid } = await resolveAuth(config, req.headers.authorization);
    if (!uid) {
      res.status(401).json({ error: 'unauthenticated', message: 'Sign in to play.' });
      return;
    }

    const body = req.body as {
      from?: { row: number; col: number };
      to?: { row: number; col: number };
      promotion?: string;
    };

    await handle(res, () =>
      service.submitMove({
        matchId: req.params.matchId,
        uid,
        from: body.from as { row: number; col: number },
        to: body.to as { row: number; col: number },
        promotion: body.promotion,
      }),
    );
  });

  // End the game: resignation or agreed draw.
  app.post('/api/match/:matchId/end', async (req: Request, res: Response) => {
    const { uid } = await resolveAuth(config, req.headers.authorization);
    if (!uid) {
      res.status(401).json({ error: 'unauthenticated', message: 'Sign in to play.' });
      return;
    }

    const body = req.body as { reason?: 'resignation' | 'draw' };
    const reason = body.reason === 'draw' ? 'draw' : 'resignation';

    await handle(res, () => service.endGame(req.params.matchId, uid, reason));
  });

  return app;
}

/** Translate a GameError into the right HTTP status and a stable body. */
async function handle(res: Response, run: () => Promise<unknown>): Promise<void> {
  try {
    const result = await run();
    res.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      const status =
        error.code === 'not-found'
          ? 404
          : error.code === 'invalid-argument'
            ? 400
            : error.code === 'aborted'
              ? 409
              : error.code === 'unauthenticated'
                ? 401
                : 422;
      res.status(status).json({ error: error.code, message: error.message });
      return;
    }
    console.error('[api] unhandled error:', error);
    res.status(500).json({ error: 'internal', message: 'Something went wrong.' });
  }
}
