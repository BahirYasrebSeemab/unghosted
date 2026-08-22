import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fixed port so the dev origin is stable — apps/api's CORS is scoped to this exact origin
// (Vite's default auto-increment-on-conflict behavior would otherwise silently break CORS).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
  },
})
