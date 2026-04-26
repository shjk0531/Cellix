import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { problems } from '../db/schema.js'

const CreateProblemBody = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    type: z.string().min(1),
    score: z.number().int().min(1).default(100),
    timeLimit: z.number().int().min(1).optional(),
    templateWorkbook: z.unknown().optional(),
    answerWorkbook: z.unknown().optional(),
    gradingConfig: z.unknown(),
    hints: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
})

const GetProblemsQuery = z.object({
    type: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    published: z.coerce.boolean().optional(),
})

export const problemRoutes: FastifyPluginAsync = async (app) => {
    app.get('/', async (request) => {
        const query = GetProblemsQuery.parse(request.query)
        const rows = await app.db.query.problems.findMany({
            where: and(
                query.published !== undefined ? eq(problems.isPublished, query.published) : undefined,
                query.difficulty ? eq(problems.difficulty, query.difficulty) : undefined,
                query.type ? eq(problems.type, query.type) : undefined,
            ),
            columns: { answerWorkbook: false, gradingConfig: false },
        })
        return { success: true, data: rows }
    })

    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        const row = await app.db.query.problems.findFirst({
            where: eq(problems.id, id),
            columns: { answerWorkbook: false, gradingConfig: false },
        })
        if (!row) return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' })
        return { success: true, data: row }
    })

    app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        const body = CreateProblemBody.parse(request.body)
        const [row] = await app.db
            .insert(problems)
            .values({ ...body, createdBy: request.userId, gradingConfig: body.gradingConfig as Record<string, unknown> })
            .returning()
        return reply.status(201).send({ success: true, data: row })
    })

    app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        const { id } = request.params as { id: string }
        const body = CreateProblemBody.partial().parse(request.body)
        const [row] = await app.db
            .update(problems)
            .set({ ...body, updatedAt: new Date() })
            .where(eq(problems.id, id))
            .returning()
        if (!row) return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' })
        return { success: true, data: row }
    })

    app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        const { id } = request.params as { id: string }
        await app.db.delete(problems).where(eq(problems.id, id))
        return { success: true, data: null }
    })
}
