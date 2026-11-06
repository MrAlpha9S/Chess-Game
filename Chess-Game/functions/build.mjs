/**
 * Bundle the Cloud Functions into a single file.
 *
 * The functions import `@chess-game/chess-engine`, which lives in a sibling
 * workspace package. Firebase uploads only the `functions/` directory, so the
 * shared engine has to be bundled in rather than resolved from node_modules.
 *
 * Run with: npm run build -w functions
 */

import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// The shared engine lives in a sibling workspace package. Firebase installs
// `functions/` on its own, so the engine is aliased to its source here and
// bundled in - it is not a runtime dependency.
const engineSource = resolve(here, '../packages/chess-engine/src/index.ts');

await rmSync(resolve(here, 'dist'), { recursive: true, force: true });
mkdirSync(resolve(here, 'dist'), { recursive: true });

await build({
  entryPoints: [resolve(here, 'src/index.ts')],
  outfile: resolve(here, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  // CommonJS is the format the Cloud Functions runtime loads most reliably.
  format: 'cjs',
  alias: {
    '@chess-game/chess-engine': engineSource,
    '@chess-game/game-service': resolve(here, '../packages/game-service/src/index.ts'),
  },
  // firebase-functions and firebase-admin are provided by the runtime.
  external: ['firebase-functions', 'firebase-admin', 'firebase-admin/*'],
  sourcemap: true,
  logLevel: 'info',
});

console.log('Functions bundled to dist/index.js');
