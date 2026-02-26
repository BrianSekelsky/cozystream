import { FastifyInstance } from 'fastify'
import { getMediaItemById } from '../db/queries'
import { getMimeType } from '../utils/fileUtils'
import { getOrCreateSession, getSession, killSession } from '../services/transcoder'
import type { ProbeResult, ExternalSubtitle } from '../services/probe'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Max buffer for subtitle extraction (10MB — subtitles are text, usually small)
const EXEC_MAX_BUFFER = 10 * 1024 * 1024

// ── Direct-play compatibility check ───────────────────────────────────────

// Codecs/containers that browsers can generally play natively
const DIRECT_PLAY_VIDEO_CODECS = new Set(['h264'])
const DIRECT_PLAY_AUDIO_CODECS = new Set(['aac', 'mp3'])

function canDirectPlay(probe: ProbeResult | null): boolean {
  // If no probe data, assume direct play (let the browser try)
  if (!probe) return true
  const videoOk = DIRECT_PLAY_VIDEO_CODECS.has(probe.videoCodec?.toLowerCase() ?? '')
  const audioOk = DIRECT_PLAY_AUDIO_CODECS.has(probe.audioCodec?.toLowerCase() ?? '')
  // FFprobe reports container as comma-separated format names like "mov,mp4,m4a,3gp,3g2,mj2"
  const container = probe.container?.toLowerCase() ?? ''
  const containerOk = container.includes('mp4') || container.includes('mov') || container.includes('m4v')
  return videoOk && audioOk && containerOk
}

// Text-based subtitle codecs that can be extracted to WebVTT
const TEXT_SUB_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text'])

import { requireAuth } from '../middleware/auth'

export async function streamingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth(fastify))

  // ── GET /api/stream/:id — Direct-play via HTTP range requests ───────

  fastify.get<{ Params: { id: string } }>('/stream/:id', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)

    if (!item || !item.file_path) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const filePath = item.file_path

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found on disk' })
    }

    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const mimeType = getMimeType(filePath)
    const rangeHeader = request.headers.range

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = Math.max(0, parseInt(parts[0], 10) || 0)
      const end = Math.min(
        parts[1] ? parseInt(parts[1], 10) : fileSize - 1,
        fileSize - 1
      )

      if (start > end) {
        reply.status(416).headers({ 'Content-Range': `bytes */${fileSize}` })
        return reply.send()
      }

      const chunkSize = end - start + 1

      reply.status(206)
      reply.headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache, no-store',
      })

      return reply.send(fs.createReadStream(filePath, { start, end }))
    }

    reply.headers({
      'Content-Length': String(fileSize),
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store',
    })
    return reply.send(fs.createReadStream(filePath))
  })

  // ── GET /api/stream/:id/info — Codec info & playback decision ───────

  fastify.get<{ Params: { id: string } }>('/stream/:id/info', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)

    if (!item) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const codecInfo: (ProbeResult & { externalSubtitles: ExternalSubtitle[] }) | null =
      item.codec_info ? JSON.parse(item.codec_info) : null

    const subtitleTracks = (codecInfo?.subtitleTracks ?? []).map(t => ({
      ...t,
      extractable: TEXT_SUB_CODECS.has(t.codec),
    }))

    const externalSubtitles = (codecInfo?.externalSubtitles ?? []).map((s, i) => ({
      index: 1000 + i,
      language: s.language,
      forced: s.forced,
      format: s.format,
    }))

    return reply.send({
      canDirectPlay: canDirectPlay(codecInfo),
      codecInfo,
      duration: item.duration ?? null,
      audioTracks: codecInfo?.audioTracks ?? [],
      subtitleTracks,
      externalSubtitles,
      directPlayUrl: `/api/stream/${id}`,
      hlsUrl: `/api/stream/${id}/hls`,
    })
  })

  // ── GET /api/stream/:id/hls — Start/reuse transcode, serve .m3u8 ───

  fastify.get<{
    Params: { id: string }
    Querystring: { start?: string; audio?: string }
  }>('/stream/:id/hls', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)

    if (!item?.file_path) {
      return reply.status(404).send({ error: 'Not found' })
    }

    if (!fs.existsSync(item.file_path)) {
      return reply.status(404).send({ error: 'File not found on disk' })
    }

    const startSeconds = parseFloat(request.query.start ?? '0')
    const audioIndex = request.query.audio ? parseInt(request.query.audio) : undefined

    const codecInfo: ProbeResult | null =
      item.codec_info ? JSON.parse(item.codec_info) : null
    const videoStreamIndex = codecInfo?.videoStreamIndex ?? undefined

    const session = getOrCreateSession(id, item.file_path, startSeconds, audioIndex, videoStreamIndex)
    await session.readyPromise

    if (!fs.existsSync(session.playlistPath)) {
      return reply.status(500).send({ error: 'Transcoding failed to start' })
    }

    reply.header('Content-Type', 'application/vnd.apple.mpegurl')
    reply.header('Cache-Control', 'no-cache, no-store')
    return reply.send(fs.createReadStream(session.playlistPath))
  })

  // ── GET /api/stream/:id/hls/:file — Serve .ts segment files ─────────

  fastify.get<{ Params: { id: string; file: string } }>(
    '/stream/:id/hls/:file',
    async (request, reply) => {
      const id = parseInt(request.params.id)
      const session = getSession(id)

      if (!session) {
        return reply.status(404).send({ error: 'No active transcode session' })
      }

      const filename = request.params.file
      // Sanitize: only allow .ts files to prevent path traversal
      if (!filename.endsWith('.ts') || filename.includes('..')) {
        return reply.status(400).send({ error: 'Invalid segment filename' })
      }

      const segPath = path.join(session.outputDir, filename)
      if (!fs.existsSync(segPath)) {
        return reply.status(404).send({ error: 'Segment not found' })
      }

      reply.header('Content-Type', 'video/mp2t')
      reply.header('Cache-Control', 'no-cache, no-store')
      return reply.send(fs.createReadStream(segPath))
    }
  )

  // ── DELETE /api/stream/:id/hls — Kill transcode session ─────────────

  fastify.delete<{ Params: { id: string } }>('/stream/:id/hls', async (request, reply) => {
    const id = parseInt(request.params.id)
    killSession(id)
    return reply.send({ ok: true })
  })

  // ── GET /api/stream/:id/subtitles/:trackIndex — Serve subtitle as WebVTT ──

  fastify.get<{ Params: { id: string; trackIndex: string } }>(
    '/stream/:id/subtitles/:trackIndex',
    async (request, reply) => {
      const id = parseInt(request.params.id)
      const trackIndex = parseInt(request.params.trackIndex)
      const item = getMediaItemById(id)

      if (!item?.file_path) {
        return reply.status(404).send({ error: 'Not found' })
      }

      const codecInfo: (ProbeResult & { externalSubtitles: ExternalSubtitle[] }) | null =
        item.codec_info ? JSON.parse(item.codec_info) : null

      if (!codecInfo) {
        return reply.status(404).send({ error: 'No codec info available' })
      }

      // External subtitle (index >= 1000)
      if (trackIndex >= 1000) {
        const extIdx = trackIndex - 1000
        const ext = codecInfo.externalSubtitles?.[extIdx]
        if (!ext || !fs.existsSync(ext.filePath)) {
          return reply.status(404).send({ error: 'External subtitle not found' })
        }

        // VTT files can be served directly
        if (ext.format === 'vtt') {
          reply.header('Content-Type', 'text/vtt')
          reply.header('Cache-Control', 'no-cache')
          return reply.send(fs.createReadStream(ext.filePath))
        }

        // Convert SRT/ASS/SSA to WebVTT via FFmpeg using a temp file
        const vttContent = await extractSubtitleToVtt(ext.filePath)
        reply.header('Content-Type', 'text/vtt')
        reply.header('Cache-Control', 'no-cache')
        return reply.send(vttContent)
      }

      // Embedded subtitle — extract via FFmpeg
      const track = codecInfo.subtitleTracks.find(t => t.index === trackIndex)
      if (!track) {
        return reply.status(404).send({ error: 'Subtitle track not found' })
      }

      if (!TEXT_SUB_CODECS.has(track.codec)) {
        return reply.status(422).send({ error: 'Bitmap subtitle formats are not supported' })
      }

      const vttContent = await extractEmbeddedSubtitleToVtt(item.file_path!, trackIndex)
      reply.header('Content-Type', 'text/vtt')
      reply.header('Cache-Control', 'no-cache')
      return reply.send(vttContent)
    }
  )
}

// ── Subtitle extraction helpers ─────────────────────────────────────────────

/** Convert an external subtitle file (SRT/ASS/SSA) to WebVTT */
function extractSubtitleToVtt(subtitlePath: string): Promise<string> {
  const tmpOut = path.join(os.tmpdir(), `cozystream-sub-${Date.now()}.vtt`)
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-y', '-i', subtitlePath,
      '-f', 'webvtt',
      tmpOut,
    ], (err) => {
      if (err) {
        // Clean up temp file on error
        try { fs.unlinkSync(tmpOut) } catch {}
        return reject(new Error(`Subtitle conversion failed: ${err.message}`))
      }
      try {
        const content = fs.readFileSync(tmpOut, 'utf-8')
        fs.unlinkSync(tmpOut)
        resolve(content)
      } catch (readErr) {
        reject(new Error(`Failed to read converted subtitle: ${readErr}`))
      }
    })
  })
}

/** Extract an embedded subtitle track from a video file to WebVTT */
function extractEmbeddedSubtitleToVtt(videoPath: string, streamIndex: number): Promise<string> {
  const tmpOut = path.join(os.tmpdir(), `cozystream-sub-${Date.now()}.vtt`)
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-y', '-i', videoPath,
      '-map', `0:${streamIndex}`,
      '-f', 'webvtt',
      tmpOut,
    ], (err) => {
      if (err) {
        try { fs.unlinkSync(tmpOut) } catch {}
        return reject(new Error(`Subtitle extraction failed: ${err.message}`))
      }
      try {
        const content = fs.readFileSync(tmpOut, 'utf-8')
        fs.unlinkSync(tmpOut)
        resolve(content)
      } catch (readErr) {
        reject(new Error(`Failed to read extracted subtitle: ${readErr}`))
      }
    })
  })
}
