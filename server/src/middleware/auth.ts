import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export function requireAuth(fastify: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }
}

export function requireAdmin(fastify: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      if ((request.user as any).role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' })
      }
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }
}
