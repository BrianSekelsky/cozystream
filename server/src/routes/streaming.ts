import { FastifyInstance } from 'fastify'
import { getMediaItemById } from '../db/queries'
import { getMimeType } from '../utils/fileUtils'
import fs from 'fs'

export async function streamingRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/stream/:id - HTTP range-request based direct play
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
      // Clamp end to fileSize-1 — Safari sometimes sends end >= fileSize
      const end = Math.min(
        parts[1] ? parseInt(parts[1], 10) : fileSize - 1,
        fileSize - 1
      )

      // Guard against a malformed range where start > end
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
        // Safari needs no-cache to make accurate range requests during seeking
        'Cache-Control': 'no-cache, no-store',
      })

      return reply.send(fs.createReadStream(filePath, { start, end }))
    }

    // Full file response
    reply.headers({
      'Content-Length': String(fileSize),
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store',
    })
    return reply.send(fs.createReadStream(filePath))
  })
}
