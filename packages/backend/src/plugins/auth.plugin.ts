import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    }
    interface FastifyRequest {
        userId: string
        userRole: 'student' | 'admin'
    }
}

const authPlugin: FastifyPluginAsync = async (app) => {
    app.decorateRequest('userId', '')
    app.decorateRequest('userRole', 'student')

    app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const payload = await request.jwtVerify<{ sub: string; role: 'student' | 'admin' }>()
            request.userId = payload.sub
            request.userRole = payload.role
        } catch {
            reply.status(401).send({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' })
        }
    })
}

export default fp(authPlugin, { name: 'auth' })
