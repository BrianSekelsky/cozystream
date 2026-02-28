import { app, dialog, shell } from 'electron'
import * as path from 'path'
import { createTray, destroyTray } from './tray'

const IS_DEV = !app.isPackaged

let serverPort = 3001

// --- Resource Paths ---
// extraResource flattens directories: ./server/dist → Resources/dist, etc.
function serverDistPath(): string {
  return IS_DEV
    ? path.join(__dirname, '..', 'server', 'dist', 'index.js')
    : path.join(process.resourcesPath!, 'dist', 'index.js')
}

// --- Server ---

async function bootServer(): Promise<number> {
  const frontendPath = IS_DEV
    ? undefined
    : path.join(process.resourcesPath!, 'browser')

  const { startServer } = require(serverDistPath())
  const { port } = await startServer({
    serveFrontend: !IS_DEV,
    frontendPath,
  })
  return port
}

function triggerLibraryScan(): void {
  try {
    const { getSetting, scanLibrary, isScanInProgress } = require(serverDistPath())

    if (isScanInProgress()) return

    const rawPaths = getSetting('library_paths')
    if (rawPaths) {
      const paths: string[] = JSON.parse(rawPaths)
      if (paths.length > 0) {
        scanLibrary(paths).catch(console.error)
      }
    }
  } catch (err) {
    console.error('[scan] Failed to trigger library scan:', err)
  }
}

// --- App Lifecycle ---

// Tray-only app: hide the dock icon on macOS
if (process.platform === 'darwin') {
  app.dock.hide()
}

app.whenReady().then(async () => {
  // Start the embedded server (skip in dev — server runs separately via tsx)
  if (!IS_DEV) {
    try {
      serverPort = await bootServer()
    } catch (err) {
      dialog.showErrorBox('Server Error', `Failed to start the CozyStream server:\n\n${err}`)
      app.quit()
      return
    }
  }

  createTray(serverPort, triggerLibraryScan)

  // Open the browser automatically on first launch
  const url = IS_DEV ? 'http://localhost:4200' : `http://localhost:${serverPort}`
  shell.openExternal(url)
})

// Clean up before quitting
app.on('before-quit', () => {
  destroyTray()
  try {
    const { cleanupAllSessions } = require(serverDistPath())
    cleanupAllSessions?.()
  } catch {
    // Server may not have started
  }
})
