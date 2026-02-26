import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

// ── Probe result types ────────────────────────────────────────────────────

export interface AudioTrack {
  index: number
  codec: string
  language: string | null
  channels: number
  title: string | null
}

export interface SubtitleTrack {
  index: number
  codec: string
  language: string | null
  title: string | null
  forced: boolean
}

export interface ExternalSubtitle {
  filePath: string
  language: string | null
  forced: boolean
  format: 'srt' | 'vtt' | 'ass' | 'ssa' | 'sub'
}

export interface ProbeResult {
  videoCodec: string | null
  videoStreamIndex: number | null
  audioCodec: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  audioTracks: AudioTrack[]
  subtitleTracks: SubtitleTrack[]
  container: string | null
  externalSubtitles: ExternalSubtitle[]
}

// ── FFprobe wrapper ───────────────────────────────────────────────────────

export function probeFile(filePath: string): Promise<Omit<ProbeResult, 'externalSubtitles'>> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)

      const videoStream = metadata.streams.find(
        s => s.codec_type === 'video' && (s as any).disposition?.attached_pic !== 1
      ) ?? metadata.streams.find(s => s.codec_type === 'video')
      const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio')
      const subStreams = metadata.streams.filter(s => s.codec_type === 'subtitle')

      const audioTracks: AudioTrack[] = audioStreams.map(s => ({
        index: s.index,
        codec: s.codec_name ?? 'unknown',
        language: (s as any).tags?.language ?? null,
        channels: s.channels ?? 2,
        title: (s as any).tags?.title ?? null,
      }))

      const subtitleTracks: SubtitleTrack[] = subStreams.map(s => ({
        index: s.index,
        codec: s.codec_name ?? 'unknown',
        language: (s as any).tags?.language ?? null,
        title: (s as any).tags?.title ?? null,
        forced: (s as any).disposition?.forced === 1,
      }))

      resolve({
        videoCodec: videoStream?.codec_name ?? null,
        videoStreamIndex: videoStream?.index ?? null,
        audioCodec: audioStreams[0]?.codec_name ?? null,
        width: videoStream?.width ?? null,
        height: videoStream?.height ?? null,
        durationSeconds: metadata.format.duration
          ? Math.round(metadata.format.duration)
          : null,
        audioTracks,
        subtitleTracks,
        container: metadata.format.format_name ?? null,
      })
    })
  })
}

// ── External subtitle detection ───────────────────────────────────────────

const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa', '.sub']

export function findExternalSubtitles(videoPath: string): ExternalSubtitle[] {
  const dir = path.dirname(videoPath)
  const base = path.basename(videoPath, path.extname(videoPath))
  const results: ExternalSubtitle[] = []

  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase()
    if (!SUBTITLE_EXTENSIONS.includes(ext)) continue

    // Match: Movie.srt, Movie.en.srt, Movie.English.srt, Movie.en.forced.srt
    if (!entry.startsWith(base)) continue

    const middle = entry.slice(base.length, -ext.length)
    const parts = middle.split('.').filter(Boolean)

    results.push({
      filePath: path.join(dir, entry),
      language: parts[0] || null,
      forced: parts.includes('forced'),
      format: ext.slice(1) as ExternalSubtitle['format'],
    })
  }

  return results
}
