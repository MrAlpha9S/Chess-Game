/**
 * Bundle the server into a single file.
 *
 * The server imports workspace packages that Firebase/Koyeb do not install on
 * their own, so they are aliased to their source and bundled in.
 */

import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await rmSync(resolve(here, 'dist'), { recursive: true, force: true });
mkdirSync(resolve(here, 'dist'), { recursive: true });

await build({
  entryPoints: [resolve(here, 'src/index.ts')],
  outfile: resolve(here, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  alias: {
    '@chess-game/chess-engine': resolve(here, '../packages/chess-engine/src/index.ts'),
    '@chess-game/game-service': resolve(here, '../packages/game-service/src/index.ts'),
  },
  // firebase-admin is provided by the runtime image; keep it external so its
  // native-ish dependencies resolve normally.
  external: ['firebase-admin', 'firebase-admin/*'],
  sourcemap: true,
  logLevel: 'info',
});

console.log('Server bundled to dist/index.js');
