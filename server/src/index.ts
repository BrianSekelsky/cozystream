import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import * as crypto from 'crypto'
import { initDB, getDB } from './db/schema'
import { libraryRoutes } from './routes/library'
import { streamingRoutes } from './routes/streaming'
import { settingsRoutes } from './routes/settings'
import { authRoutes } from './routes/auth'
import { getSetting, setSetting } from './db/queries'
import { scanLibrary } from './services/scanner'
import { cleanupAllSessions } from './services/transcoder'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
})

async function main(): Promise<void> {
  // Enable CORS for the Vite dev server
  await server.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // Initialize database
  initDB()
  console.log('[db] Database initialized')

  // Set up JWT with a persisted secret
  let jwtSecret = getSetting('jwt_secret')
  if (!jwtSecret) {
    jwtSecret = crypto.randomBytes(32).toString('hex')
    setSetting('jwt_secret', jwtSecret)
  }
  await server.register(jwt, { secret: jwtSecret })

  // Restore TMDB API key from DB if not in env
  const storedKey = getSetting('tmdb_api_key')
  if (storedKey && !process.env.TMDB_API_KEY) {
    process.env.TMDB_API_KEY = storedKey
    console.log('[config] Loaded TMDB API key from database')
  }

  // Register routes
  await server.register(authRoutes, { prefix: '/api' })
  await server.register(libraryRoutes, { prefix: '/api' })
  await server.register(streamingRoutes, { prefix: '/api' })
  await server.register(settingsRoutes, { prefix: '/api' })

  // Health check
  server.get('/health', async () => ({ status: 'ok', version: '0.1.0' }))

  await server.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\n🎬 CozyStream server running on http://localhost:${PORT}\n`)

  // Kick off an initial scan if library paths are configured
  const rawPaths = getSetting('library_paths')
  if (rawPaths) {
    const paths: string[] = JSON.parse(rawPaths)
    if (paths.length > 0) {
      console.log('[scanner] Starting initial library scan...')
      scanLibrary(paths).catch(console.error)
    }
  }
}

// Clean up transcode sessions on shutdown
process.on('SIGINT', () => {
  cleanupAllSessions()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanupAllSessions()
  process.exit(0)
})

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
