import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Point at the engine source so the client picks up changes without a rebuild.
      '@chess-game/chess-engine': fileURLToPath(
        new URL('./packages/chess-engine/src/index.ts', import.meta.url),
      ),
    },
  },
})
