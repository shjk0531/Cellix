import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { env } from './config/env.js'
import dbPlugin from './plugins/db.plugin.js'
import redisPlugin from './plugins/redis.plugin.js'
import authPlugin from './plugins/auth.plugin.js'
import { authRoutes } from './routes/auth.routes.js'
import { problemRoutes } from './routes/problems.routes.js'
import { submissionRoutes } from './routes/submissions.routes.js'
import { userRoutes } from './routes/users.routes.js'
import type { ApiResponse } from '@cellix/shared'

export async function buildApp() {
    const app = Fastify({
        logger: env.NODE_ENV === 'development'
            ? { transport: { target: 'pino-pretty' } }
            : true,
    })

    await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true })
    await app.register(cookie)
    await app.register(jwt, { secret: env.JWT_SECRET ?? 'dev-secret-change-in-prod-min32chars!!' })
    await app.register(dbPlugin)
    await app.register(redisPlugin)
    await app.register(authPlugin)

    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.register(problemRoutes, { prefix: '/api/problems' })
    await app.register(submissionRoutes, { prefix: '/api/submissions' })
    await app.register(userRoutes, { prefix: '/api/users' })

    app.get('/api/health', async (): Promise<ApiResponse<{ status: string; env: string }>> => {
        return { success: true, data: { status: 'ok', env: env.NODE_ENV } }
    })

    app.setErrorHandler((error, _request, reply) => {
        app.log.error(error)
        if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
            return reply.status(error.statusCode).send({
                success: false,
                error: error.message,
                code: 'VALIDATION_ERROR',
            })
        }
        return reply.status(500).send({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
        })
    })

    return app
}
