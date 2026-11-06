import { defineConfig } from 'vitest/config';

/**
 * Config for the security-rules test.
 *
 * The rules test talks to the RTDB emulator, so it must not be picked up by
 * the default `npm test` run (which does not assume an emulator is up).
 */
export default defineConfig({
  test: {
    include: ['tests/rules.test.ts'],
  },
});
