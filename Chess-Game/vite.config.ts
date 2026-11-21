import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // The default pool does not start its workers under Node >= 26
    // ("Cannot read properties of undefined (reading 'config')"),
    // so the suite runs on the in-process vmThreads pool instead.
    pool: 'vmThreads',
  },
})
