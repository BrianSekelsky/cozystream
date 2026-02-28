import 'dotenv/config'
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import * as crypto from 'crypto'
import * as path from 'path'
import * as fs from 'fs'
import { initDB, getDB } from './db/schema'
import { libraryRoutes } from './routes/library'
import { streamingRoutes } from './routes/streaming'
import { settingsRoutes } from './routes/settings'
import { authRoutes } from './routes/auth'
import { getSetting, setSetting } from './db/queries'
import { scanLibrary, isScanInProgress, getLibraryPaths } from './services/scanner'
import { cleanupAllSessions } from './services/transcoder'
import { initFfmpegPaths } from './utils/ffmpeg'
export { cleanupAllSessions, getSetting, scanLibrary, isScanInProgress }

// Configure bundled ffmpeg/ffprobe paths before anything uses them
initFfmpegPaths()

export interface StartServerOptions {
  port?: number
  serveFrontend?: boolean
  frontendPath?: string
}

export async function startServer(options: StartServerOptions = {}): Promise<{ server: FastifyInstance; port: number }> {
  const port = options.port ?? parseInt(process.env.PORT ?? '3001', 10)
  const isElectron = !!(process as any).versions?.electron

  const server = Fastify({
    logger: {
      // pino-pretty uses worker threads which can fail in packaged Electron apps
      ...(isElectron ? {} : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
    bodyLimit: 1_048_576, // 1 MB max request body
  })

  // Enable CORS — needed for dev servers and TV app (which runs from a different origin)
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  // Security headers
  await server.register(helmet, {
    contentSecurityPolicy: false, // handled by Angular or reverse proxy in production
    crossOriginEmbedderPolicy: false, // allow loading media/images from external sources (TMDB posters)
  })

  // Cookie support for httpOnly auth cookies
  await server.register(cookie)

  // Initialize database
  initDB()
  console.log('[db] Database initialized')

  // Set up JWT with a persisted secret
  let jwtSecret = getSetting('jwt_secret')
  if (!jwtSecret) {
    jwtSecret = crypto.randomBytes(32).toString('hex')
    setSetting('jwt_secret', jwtSecret)
  }
  await server.register(jwt, {
    secret: jwtSecret,
    verify: {
      extractToken: (request) => {
        // 1. Authorization header (legacy / third-party clients)
        const auth = request.headers.authorization
        if (auth?.startsWith('Bearer ')) return auth.slice(7)
        // 2. httpOnly cookie (primary method for browser clients)
        return (request as any).cookies?.cozystream_token ?? undefined
      },
    },
  })

  // Restore TMDB API key from DB if not in env
  const storedKey = getSetting('tmdb_api_key')
  if (storedKey && !process.env.TMDB_API_KEY) {
    process.env.TMDB_API_KEY = storedKey
    console.log('[config] Loaded TMDB API key from database')
  }

  // CSRF protection: reject state-changing requests without JSON content-type.
  // Browsers won't send Content-Type: application/json from cross-origin form
  // submissions, so this blocks CSRF attacks alongside sameSite:strict cookies.
  server.addHook('onRequest', async (request, reply) => {
    const method = request.method
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const ct = request.headers['content-type'] ?? ''
      // Allow empty bodies (e.g. DELETE with no payload) and JSON
      if (request.headers['content-length'] && request.headers['content-length'] !== '0' && !ct.includes('application/json')) {
        return reply.status(415).send({ error: 'Content-Type must be application/json' })
      }
    }
  })

  // Register routes
  await server.register(authRoutes, { prefix: '/api' })
  await server.register(libraryRoutes, { prefix: '/api' })
  await server.register(streamingRoutes, { prefix: '/api' })
  await server.register(settingsRoutes, { prefix: '/api' })

  // Health check
  server.get('/health', async () => ({ status: 'ok', version: '0.1.0' }))

  // Localhost-only scan trigger (no auth required)
  // Used by the native macOS tray app to trigger scans without browser auth
  server.post('/api/library/internal-scan', async (request, reply) => {
    const remoteAddr = request.ip
    if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && remoteAddr !== '::ffff:127.0.0.1') {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (isScanInProgress()) {
      return reply.send({ status: 'already_running' })
    }
    const paths = getLibraryPaths()
    if (paths.length === 0) {
      return reply.send({ status: 'no_paths' })
    }
    scanLibrary(paths).catch(console.error)
    return reply.send({ status: 'started' })
  })

  // Serve Angular frontend as static files
  if (options.serveFrontend) {
    const frontendDir = options.frontendPath ?? path.join(__dirname, '..', '..', 'dist', 'cozystream-angular', 'browser')

    if (fs.existsSync(frontendDir)) {
      await server.register(fastifyStatic, {
        root: frontendDir,
        prefix: '/',
      })

      // SPA fallback: serve index.html for non-API routes
      server.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/') || request.url.startsWith('/health')) {
          return reply.status(404).send({ error: 'Not found' })
        }
        return reply.sendFile('index.html')
      })
    } else {
      console.warn(`[static] Frontend directory not found: ${frontendDir}`)
    }
  }

  await server.listen({ port, host: '0.0.0.0' })
  console.log(`\n🎬 CozyStream server running on http://localhost:${port}\n`)

  // Kick off an initial scan if library paths are configured
  const rawPaths = getSetting('library_paths')
  if (rawPaths) {
    const paths: string[] = JSON.parse(rawPaths)
    if (paths.length > 0) {
      console.log('[scanner] Starting initial library scan...')
      scanLibrary(paths).catch(console.error)
    }
  }

  return { server, port }
}

// Run standalone when executed directly (not imported by Electron)
if (require.main === module) {
  // Clean up transcode sessions on shutdown
  process.on('SIGINT', () => {
    cleanupAllSessions()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanupAllSessions()
    process.exit(0)
  })

  const options: StartServerOptions = {}
  if (process.env.COZYSTREAM_SERVE_FRONTEND === 'true') {
    options.serveFrontend = true
    if (process.env.COZYSTREAM_FRONTEND_PATH) {
      options.frontendPath = process.env.COZYSTREAM_FRONTEND_PATH
    }
  }

  startServer(options).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
