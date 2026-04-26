import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authService } from '../services/auth.service.js'
import { env } from '../config/env.js'

const RegisterBody = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(100),
})

const LoginBody = z.object({
    email: z.string().email(),
    password: z.string().min(1),
})

export const authRoutes: FastifyPluginAsync = async (app) => {
    app.post('/register', async (request, reply) => {
        const body = RegisterBody.parse(request.body)
        try {
            const user = await authService.register(app.db, body)
            const token = app.jwt.sign(
                { sub: user.id, role: user.role },
                { expiresIn: env.JWT_EXPIRES_IN },
            )
            reply.setCookie('token', token, { httpOnly: true, path: '/', sameSite: 'lax' })
            return reply.status(201).send({ success: true, data: { user, token } })
        } catch (err: unknown) {
            const e = err as { code?: string; message?: string }
            if (e.code === 'CONFLICT') {
                return reply.status(409).send({ success: false, error: e.message, code: 'CONFLICT' })
            }
            throw err
        }
    })

    app.post('/login', async (request, reply) => {
        const body = LoginBody.parse(request.body)
        try {
            const user = await authService.login(app.db, body)
            const token = app.jwt.sign(
                { sub: user.id, role: user.role },
                { expiresIn: env.JWT_EXPIRES_IN },
            )
            reply.setCookie('token', token, { httpOnly: true, path: '/', sameSite: 'lax' })
            return { success: true, data: { user, token } }
        } catch (err: unknown) {
            const e = err as { code?: string; message?: string }
            if (e.code === 'UNAUTHORIZED') {
                return reply.status(401).send({ success: false, error: e.message, code: 'UNAUTHORIZED' })
            }
            throw err
        }
    })

    app.post('/logout', async (_request, reply) => {
        reply.clearCookie('token', { path: '/' })
        return { success: true, data: null }
    })

    app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
        const user = await authService.findById(app.db, request.userId)
        if (!user) return { success: false, error: 'User not found', code: 'NOT_FOUND' }
        return { success: true, data: user }
    })
}
