import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// La versión que sale en la esquina de la app: fecha del build y commit.
// En Vercel el commit viene en VERCEL_GIT_COMMIT_SHA; en local se le
// pregunta a git. Si ninguno responde, queda solo la fecha.
function version() {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  let sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)
  if (!sha) {
    try { sha = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
    catch { sha = '' }
  }
  return sha ? `${fecha} · ${sha}` : fecha
}

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version()) },
  // Firebase y React cambian casi nunca; la app, cada semana. En archivos
  // aparte el navegador los guarda y en cada despliegue solo baja lo nuevo.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
          if (id.includes('node_modules/react')) return 'react'
        },
      },
    },
  },
})
