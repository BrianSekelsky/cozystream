import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import os from 'os'
import fs from 'fs'

const CACHE_BASE = path.join(os.homedir(), '.cozystream', 'transcode-cache')

// ── Session types ─────────────────────────────────────────────────────────

export interface TranscodeSession {
  id: string
  mediaItemId: number
  outputDir: string
  playlistPath: string
  process: ReturnType<typeof ffmpeg> | null
  ready: boolean
  readyPromise: Promise<void>
  startedAt: number
  lastAccessedAt: number
  startSeconds: number
}

// ── Active sessions ───────────────────────────────────────────────────────

const activeSessions = new Map<number, TranscodeSession>()

// Reap idle sessions every 5 minutes (idle = no segment read for 30 min)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  activeSessions.forEach((session, id) => {
    if (now - session.lastAccessedAt > IDLE_TIMEOUT_MS) {
      console.log(`[transcoder] Reaping idle session ${session.id}`)
      killSession(id)
    }
  })
}, 5 * 60 * 1000)

// ── Public API ────────────────────────────────────────────────────────────

export function getOrCreateSession(
  mediaItemId: number,
  filePath: string,
  startSeconds = 0,
  audioTrackIndex?: number,
  videoStreamIndex?: number,
): TranscodeSession {
  const existing = activeSessions.get(mediaItemId)
  if (existing) {
    existing.lastAccessedAt = Date.now()
    return existing
  }

  const sessionId = `${mediaItemId}-${Date.now()}`
  const outputDir = path.join(CACHE_BASE, sessionId)
  fs.mkdirSync(outputDir, { recursive: true })

  const playlistPath = path.join(outputDir, 'stream.m3u8')

  // The base URL that FFmpeg writes into the m3u8 for segment references
  const hlsBaseUrl = `/api/stream/${mediaItemId}/hls/`

  let resolveReady!: () => void
  const readyPromise = new Promise<void>(r => { resolveReady = r })

  const outputOptions = [
    '-c:v libx264',
    '-profile:v high',
    '-pix_fmt yuv420p',
    '-preset veryfast',
    '-crf 23',
    '-c:a aac',
    '-b:a 192k',
    '-ac 2',
    videoStreamIndex != null ? `-map 0:${videoStreamIndex}` : '-map 0:v:0',
    `-map 0:a:${audioTrackIndex ?? 0}`,
    '-f hls',
    '-hls_time 6',
    '-hls_list_size 0',
    '-hls_playlist_type event',
    `-hls_base_url ${hlsBaseUrl}`,
    '-hls_segment_filename', path.join(outputDir, 'seg_%05d.ts'),
    '-start_number 0',
  ]

  const command = ffmpeg(filePath)
    .seekInput(startSeconds)
    .outputOptions(outputOptions)
    .output(playlistPath)
    .on('start', (cmd) => {
      console.log(`[transcoder] Started session ${sessionId}: ${cmd}`)
    })
    .on('error', (err) => {
      // "Output stream closed" is normal when we kill the process
      if (!err.message.includes('SIGKILL') && !err.message.includes('Output stream closed')) {
        console.error(`[transcoder] Error in session ${sessionId}:`, err.message)
      }
      activeSessions.delete(mediaItemId)
    })
    .on('end', () => {
      console.log(`[transcoder] Session ${sessionId} completed`)
    })

  command.run()

  // Poll until FFmpeg has produced enough segments for smooth playback.
  // Waiting for 3 segments (~18s of content) avoids the stall that occurs
  // when the player reaches the end of segment 0 before segment 1 is ready
  // (common with HEVC sources that are slow to decode).
  const MIN_SEGMENTS = 3
  const checkReady = setInterval(() => {
    if (fs.existsSync(playlistPath)) {
      try {
        const playlist = fs.readFileSync(playlistPath, 'utf-8')
        const segmentCount = (playlist.match(/\.ts\s*$/gm) || []).length
        const isComplete = playlist.includes('#EXT-X-ENDLIST')
        if (segmentCount >= MIN_SEGMENTS || isComplete) {
          clearInterval(checkReady)
          resolveReady()
          session.ready = true
        }
      } catch { /* file may be mid-write, retry next tick */ }
    }
  }, 300)

  // Safety: stop polling after 60 seconds to avoid infinite loop if FFmpeg fails
  setTimeout(() => {
    clearInterval(checkReady)
    if (!session.ready) {
      // If we have at least the playlist file, start anyway rather than failing
      if (fs.existsSync(playlistPath)) {
        session.ready = true
      } else {
        console.error(`[transcoder] Session ${sessionId} timed out waiting for playlist`)
      }
      resolveReady()
    }
  }, 60000)

  const session: TranscodeSession = {
    id: sessionId,
    mediaItemId,
    outputDir,
    playlistPath,
    process: command,
    ready: false,
    readyPromise,
    startedAt: Date.now(),
    lastAccessedAt: Date.now(),
    startSeconds,
  }

  activeSessions.set(mediaItemId, session)
  return session
}

export function getSession(mediaItemId: number): TranscodeSession | undefined {
  const session = activeSessions.get(mediaItemId)
  if (session) {
    session.lastAccessedAt = Date.now()
  }
  return session
}

export function killSession(mediaItemId: number): void {
  const session = activeSessions.get(mediaItemId)
  if (!session) return

  try {
    (session.process as any)?.kill?.('SIGKILL')
  } catch { /* ignore */ }

  try {
    fs.rmSync(session.outputDir, { recursive: true, force: true })
  } catch { /* ignore */ }

  activeSessions.delete(mediaItemId)
  console.log(`[transcoder] Killed session ${session.id}`)
}

export function cleanupAllSessions(): void {
  activeSessions.forEach((_session, id) => {
    killSession(id)
  })
  // Clean the entire cache directory
  try {
    if (fs.existsSync(CACHE_BASE)) {
      fs.rmSync(CACHE_BASE, { recursive: true, force: true })
    }
  } catch { /* ignore */ }
}
