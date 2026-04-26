import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'

const SALT_ROUNDS = 10
const ACCESS_TOKEN_EXPIRES = '1h'
const REFRESH_TOKEN_EXPIRES_SEC = 7 * 24 * 60 * 60

const COOKIE_NAME = 'refreshToken'
const COOKIE_OPTS = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: false,  // true in production (set via env)
}

const RegisterBody = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(100),
})

const LoginBody = z.object({
    email: z.string().email(),
    password: z.string().min(1),
})

function safeUser(user: { id: string; email: string; name: string; role: string }) {
    return { id: user.id, email: user.email, name: user.name, role: user.role }
}

export const authRoutes: FastifyPluginAsync = async (app) => {
    app.post('/register', async (request, reply) => {
        const body = RegisterBody.parse(request.body)

        const existing = await app.db.query.users.findFirst({ where: eq(users.email, body.email) })
        if (existing) {
            return reply.status(409).send({ success: false, error: 'Email already in use', code: 'CONFLICT' })
        }

        const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS)
        const [user] = await app.db
            .insert(users)
            .values({ email: body.email, passwordHash, name: body.name })
            .returning({ id: users.id, email: users.email, name: users.name, role: users.role })

        return reply.status(201).send({ success: true, data: { user } })
    })

    app.post('/login', async (request, reply) => {
        const body = LoginBody.parse(request.body)

        const user = await app.db.query.users.findFirst({ where: eq(users.email, body.email) })
        if (!user) {
            return reply.status(401).send({ success: false, error: 'Invalid credentials', code: 'UNAUTHORIZED' })
        }

        const valid = await bcrypt.compare(body.password, user.passwordHash)
        if (!valid) {
            return reply.status(401).send({ success: false, error: 'Invalid credentials', code: 'UNAUTHORIZED' })
        }

        const accessToken = app.jwt.sign(
            { sub: user.id, role: user.role },
            { expiresIn: ACCESS_TOKEN_EXPIRES },
        )

        const refreshToken = crypto.randomUUID()
        await app.redis.setex(`refresh:${refreshToken}`, REFRESH_TOKEN_EXPIRES_SEC, user.id)
        reply.setCookie(COOKIE_NAME, refreshToken, COOKIE_OPTS)

        return { success: true, data: { accessToken, user: safeUser(user) } }
    })

    app.post('/refresh', async (request, reply) => {
        const token = request.cookies[COOKIE_NAME]
        if (!token) {
            return reply.status(401).send({ success: false, error: 'No refresh token', code: 'UNAUTHORIZED' })
        }

        const userId = await app.redis.get(`refresh:${token}`)
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Invalid or expired refresh token', code: 'UNAUTHORIZED' })
        }

        const user = await app.db.query.users.findFirst({ where: eq(users.id, userId) })
        if (!user) {
            return reply.status(401).send({ success: false, error: 'User not found', code: 'UNAUTHORIZED' })
        }

        // Rotate: delete old, issue new
        await app.redis.del(`refresh:${token}`)
        const newRefreshToken = crypto.randomUUID()
        await app.redis.setex(`refresh:${newRefreshToken}`, REFRESH_TOKEN_EXPIRES_SEC, user.id)
        reply.setCookie(COOKIE_NAME, newRefreshToken, COOKIE_OPTS)

        const accessToken = app.jwt.sign(
            { sub: user.id, role: user.role },
            { expiresIn: ACCESS_TOKEN_EXPIRES },
        )

        return { success: true, data: { accessToken, user: safeUser(user) } }
    })

    app.post('/logout', async (request, reply) => {
        const token = request.cookies[COOKIE_NAME]
        if (token) {
            await app.redis.del(`refresh:${token}`)
        }
        reply.clearCookie(COOKIE_NAME, { path: '/' })
        return { success: true, data: null }
    })

    app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
        const user = await app.db.query.users.findFirst({
            where: eq(users.id, request.userId),
            columns: { passwordHash: false },
        })
        if (!user) return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' })
        return { success: true, data: user }
    })
}
