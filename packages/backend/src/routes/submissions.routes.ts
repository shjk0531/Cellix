import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { submissions, userProgress } from '../db/schema.js'

const SubmitBody = z.object({
    problemId: z.string().uuid(),
    submittedWorkbook: z.unknown(),
    timeSpentSeconds: z.number().int().min(0).optional(),
})

export const submissionRoutes: FastifyPluginAsync = async (app) => {
    app.get('/my', { preHandler: [app.authenticate] }, async (request) => {
        const rows = await app.db.query.submissions.findMany({
            where: eq(submissions.userId, request.userId),
        })
        return { success: true, data: rows }
    })

    app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const row = await app.db.query.submissions.findFirst({
            where: eq(submissions.id, id),
        })
        if (!row) return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' })
        if (row.userId !== request.userId && request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        return { success: true, data: row }
    })

    app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
        const body = SubmitBody.parse(request.body)
        const [row] = await app.db
            .insert(submissions)
            .values({
                userId: request.userId,
                problemId: body.problemId,
                submittedWorkbook: body.submittedWorkbook as Record<string, unknown>,
                timeSpentSeconds: body.timeSpentSeconds,
            })
            .returning()

        // 진행 상황 upsert
        const existing = await app.db.query.userProgress.findFirst({
            where: and(
                eq(userProgress.userId, request.userId),
                eq(userProgress.problemId, body.problemId),
            ),
        })
        if (existing) {
            await app.db
                .update(userProgress)
                .set({ attempts: existing.attempts + 1, lastAttemptAt: new Date() })
                .where(
                    and(
                        eq(userProgress.userId, request.userId),
                        eq(userProgress.problemId, body.problemId),
                    ),
                )
        } else {
            await app.db.insert(userProgress).values({
                userId: request.userId,
                problemId: body.problemId,
                attempts: 1,
                lastAttemptAt: new Date(),
            })
        }

        return reply.status(201).send({ success: true, data: row })
    })
}
