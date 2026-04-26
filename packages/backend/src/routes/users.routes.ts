import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'
import { authService } from '../services/auth.service.js'

const UpdateMeBody = z.object({
    name: z.string().min(1).max(100).optional(),
})

export const userRoutes: FastifyPluginAsync = async (app) => {
    app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
        const user = await authService.findById(app.db, request.userId)
        if (!user) return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' })
        return { success: true, data: user }
    })

    app.patch('/me', { preHandler: [app.authenticate] }, async (request) => {
        const body = UpdateMeBody.parse(request.body)
        const [row] = await app.db
            .update(users)
            .set({ ...body, updatedAt: new Date() })
            .where(eq(users.id, request.userId))
            .returning({ id: users.id, email: users.email, name: users.name, role: users.role })
        return { success: true, data: row }
    })

    app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        const rows = await app.db.query.users.findMany({
            columns: { passwordHash: false },
        })
        return { success: true, data: rows }
    })
}
