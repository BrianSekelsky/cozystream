import { FastifyInstance } from 'fastify'
import { getSetting, setSetting } from '../db/queries'
import { scanLibrary, isScanInProgress } from '../services/scanner'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'

const execFileAsync = promisify(execFile)

interface SettingsBody {
  library_paths?: string[]
  tmdb_api_key?: string
}

import { requireAdmin } from '../middleware/auth'

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAdmin(fastify))
  // GET /api/settings/pick-folder — opens a native OS folder picker dialog
  fastify.get('/settings/pick-folder', async (_request, reply) => {
    // When running inside Electron, use the native dialog injected by the main process
    const electronDialog = (global as any).__electronDialog
    if (electronDialog) {
      try {
        return await electronDialog()
      } catch {
        return reply.status(500).send({ error: 'Failed to open folder picker' })
      }
    }

    const platform = os.platform()

    try {
      let folderPath: string | null = null

      if (platform === 'darwin') {
        const { stdout } = await execFileAsync('osascript', [
          '-e',
          'POSIX path of (choose folder with prompt "Select a media folder")',
        ])
        folderPath = stdout.trim().replace(/\/$/, '') // strip trailing slash
      } else if (platform === 'linux') {
        // Try zenity (GNOME), then kdialog (KDE)
        try {
          const { stdout } = await execFileAsync('zenity', [
            '--file-selection',
            '--directory',
            '--title=Select a media folder',
          ])
          folderPath = stdout.trim()
        } catch {
          const { stdout } = await execFileAsync('kdialog', [
            '--getexistingdirectory',
            os.homedir(),
            '--title',
            'Select a media folder',
          ])
          folderPath = stdout.trim()
        }
      } else {
        return reply.status(501).send({ error: 'Native folder picker not supported on this platform' })
      }

      return { path: folderPath, cancelled: false }
    } catch (err: any) {
      // osascript exits with code 1 when user presses Cancel
      if (err.code === 1 || (err.stderr && /cancelled/i.test(err.stderr))) {
        return { path: null, cancelled: true }
      }
      console.error('[pick-folder] error:', err)
      return reply.status(500).send({ error: 'Failed to open folder picker' })
    }
  })

  // GET /api/settings — never return the actual API key to the frontend
  fastify.get('/settings', async () => {
    const rawPaths = getSetting('library_paths')
    const library_paths: string[] = rawPaths ? JSON.parse(rawPaths) : []
    const hasKey = !!getSetting('tmdb_api_key')

    return { library_paths, tmdb_api_key: hasKey ? '••••••••' : '', has_tmdb_api_key: hasKey }
  })

  // POST /api/settings
  fastify.post<{ Body: SettingsBody }>('/settings', async (request, reply) => {
    const { library_paths, tmdb_api_key } = request.body

    if (library_paths !== undefined) {
      // Validate paths exist
      const invalid = library_paths.filter((p) => !fs.existsSync(p))
      if (invalid.length > 0) {
        return reply.status(400).send({ error: `Paths do not exist: ${invalid.join(', ')}` })
      }
      setSetting('library_paths', JSON.stringify(library_paths))

      // Set env var for metadata service to pick up if provided separately
      if (tmdb_api_key) {
        process.env.TMDB_API_KEY = tmdb_api_key
        setSetting('tmdb_api_key', tmdb_api_key)
      }

      // Trigger a scan automatically when paths change
      if (!isScanInProgress()) {
        scanLibrary(library_paths).catch(console.error)
      }
    }

    if (tmdb_api_key !== undefined && library_paths === undefined) {
      process.env.TMDB_API_KEY = tmdb_api_key
      setSetting('tmdb_api_key', tmdb_api_key)
    }

    return { ok: true }
  })
}
