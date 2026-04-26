import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { users, submissions, userProgress, problems } from '../db/schema.js'
import { authService } from '../services/auth.service.js'

const UpdateMeBody = z.object({
    name: z.string().min(1).max(100).optional(),
})

const PaginationQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
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

    app.get('/me/progress', { preHandler: [app.authenticate] }, async (request) => {
        const rows = await app.db
            .select({
                problemId: userProgress.problemId,
                bestScore: userProgress.bestScore,
                attempts: userProgress.attempts,
                lastAttemptAt: userProgress.lastAttemptAt,
                problemTitle: problems.title,
                problemDifficulty: problems.difficulty,
                problemType: problems.type,
                problemScore: problems.score,
            })
            .from(userProgress)
            .innerJoin(problems, eq(userProgress.problemId, problems.id))
            .where(eq(userProgress.userId, request.userId))
        return { success: true, data: rows }
    })

    app.get('/me/submissions', { preHandler: [app.authenticate] }, async (request) => {
        const query = PaginationQuery.parse(request.query)
        const offset = (query.page - 1) * query.limit
        const rows = await app.db
            .select()
            .from(submissions)
            .where(eq(submissions.userId, request.userId))
            .orderBy(desc(submissions.submittedAt))
            .limit(query.limit)
            .offset(offset)
        return { success: true, data: rows }
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
