import type { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import {
  getUserCount, getUserByUsername, getUserById, createUser, getAllUsers,
  createInviteCode, getInviteCode, markInviteCodeUsed,
  getInviteCodes, deleteInviteCode,
  migrateGlobalFavoritesAndWatchlist,
} from '../db/auth-queries'
import { requireAuth, requireAdmin } from '../middleware/auth'

const BCRYPT_ROUNDS = 12
const MAX_PASSWORD_LENGTH = 72

const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (request: any) => request.ip,
      errorResponseBuilder: () => ({ error: 'Too many requests, please try again later' }),
    },
  },
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, { global: false })

  // Public: check if initial setup is needed
  fastify.get('/auth/status', async () => {
    const count = getUserCount()
    return { setupRequired: count === 0 }
  })

  // Public: register a new account
  fastify.post<{
    Body: { username: string; password: string; displayName: string; inviteCode?: string }
  }>('/auth/register', authRateLimit, async (request, reply) => {
    const { username, password, displayName, inviteCode } = request.body

    if (!username || !password || !displayName) {
      return reply.status(400).send({ error: 'Username, password, and display name are required' })
    }
    if (username.length < 3) {
      return reply.status(400).send({ error: 'Username must be at least 3 characters' })
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' })
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return reply.status(400).send({ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` })
    }

    const existing = getUserByUsername(username)
    if (existing) {
      return reply.status(409).send({ error: 'Username already taken' })
    }

    const count = getUserCount()
    const isFirstUser = count === 0

    // Non-first users require a valid invite code
    if (!isFirstUser) {
      if (!inviteCode) {
        return reply.status(400).send({ error: 'Invite code is required' })
      }
      const code = getInviteCode(inviteCode)
      if (!code || code.used_by !== null) {
        return reply.status(400).send({ error: 'Invalid or already used invite code' })
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const role = isFirstUser ? 'admin' : 'member'
    const userId = createUser(username, passwordHash, displayName, role)

    // Mark invite code as used
    if (!isFirstUser && inviteCode) {
      markInviteCodeUsed(inviteCode, userId)
    }

    // Migrate existing global favorites/watchlist to the first user
    if (isFirstUser) {
      migrateGlobalFavoritesAndWatchlist(userId)
    }

    const token = fastify.jwt.sign({ id: userId, username, role }, { expiresIn: '7d' })

    return {
      token,
      user: { id: userId, username, displayName, role },
    }
  })

  // Public: login
  fastify.post<{
    Body: { username: string; password: string }
  }>('/auth/login', authRateLimit, async (request, reply) => {
    const { username, password } = request.body

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required' })
    }

    const user = getUserByUsername(username)
    if (!user) {
      return reply.status(401).send({ error: 'Invalid username or password' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid username or password' })
    }

    const token = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '7d' }
    )

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    }
  })

  // Authenticated: get current user info (from database, not JWT payload)
  fastify.get('/auth/me', { preHandler: requireAuth(fastify) }, async (request, reply) => {
    const { id } = request.user as { id: number }
    const user = getUserById(id)
    if (!user) return reply.status(401).send({ error: 'User not found' })
    return { id: user.id, username: user.username, displayName: user.display_name, role: user.role }
  })

  // Admin: generate invite code
  fastify.post('/auth/invite-codes', { preHandler: requireAdmin(fastify) }, async (request) => {
    const { id: adminId } = request.user as { id: number }
    const code = crypto.randomBytes(16).toString('hex')
    createInviteCode(code, adminId)
    return { code }
  })

  // Admin: list all invite codes
  fastify.get('/auth/invite-codes', { preHandler: requireAdmin(fastify) }, async (request) => {
    const { id: adminId } = request.user as { id: number }
    return getInviteCodes(adminId)
  })

  // Admin: delete unused invite code
  fastify.delete<{ Params: { code: string } }>(
    '/auth/invite-codes/:code',
    { preHandler: requireAdmin(fastify) },
    async (request) => {
      const { id: adminId } = request.user as { id: number }
      deleteInviteCode(request.params.code, adminId)
      return { ok: true }
    }
  )

  // Admin: list all users
  fastify.get('/auth/users', { preHandler: requireAdmin(fastify) }, async () => {
    return getAllUsers()
  })
}
