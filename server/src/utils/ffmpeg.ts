import ffmpeg from 'fluent-ffmpeg'

let ffmpegBinaryPath: string | null = null

export function getFfmpegPath(): string {
  if (ffmpegBinaryPath) return ffmpegBinaryPath
  // Fallback to system PATH
  return 'ffmpeg'
}

export function initFfmpegPaths(): void {
  try {
    // ffmpeg-static provides a pre-built ffmpeg binary
    const ffmpegStatic = require('ffmpeg-static') as string
    if (ffmpegStatic) {
      ffmpegBinaryPath = ffmpegStatic
      ffmpeg.setFfmpegPath(ffmpegStatic)
    }
  } catch {
    console.warn('[ffmpeg] ffmpeg-static not found, falling back to system ffmpeg')
  }

  try {
    // ffprobe-static provides a pre-built ffprobe binary
    const ffprobeStatic = require('ffprobe-static') as { path: string }
    if (ffprobeStatic?.path) {
      ffmpeg.setFfprobePath(ffprobeStatic.path)
    }
  } catch {
    console.warn('[ffmpeg] ffprobe-static not found, falling back to system ffprobe')
  }
}
