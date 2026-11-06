/**
 * Entrypoint: wire up storage, service, and the HTTP server.
 */

import { createApp } from './app';
import { loadConfig } from './config';
import { RtdbGameStorage, initDatabase } from './storage';
import { GameService } from '@chess-game/game-service';

async function main() {
  const config = loadConfig();
  const database = initDatabase(config);
  const service = new GameService(new RtdbGameStorage(database));
  const app = createApp({ config, service });

  app.listen(config.port, () => {
    console.log(`chess-game-server listening on :${config.port}`);
    console.log(`  project: ${config.projectId}`);
    console.log(`  database: ${config.databaseURL}`);
  });
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
