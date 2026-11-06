import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The rules test needs the RTDB emulator running, so it is excluded
    // from the default run. Use `npm run test:rules` for it.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules.test.ts'],
  },
});
