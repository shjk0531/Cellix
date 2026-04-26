import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, sql, count } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { problems, userProgress } from '../db/schema.js'
import type { SerializedWorkbookData } from '@cellix/shared'

// ── GradingConfig (backend-local) ─────────────────────────────────────────────

const GradingCellSchema = z.object({
    sheetId: z.string(),
    address: z.string(),
    expectedValue: z.unknown().optional(),
    tolerance: z.number().optional(),
    checkFormula: z.boolean().optional(),
    formulaPattern: z.string().optional(),
    scoreWeight: z.number(),
})

const GradingConfigSchema = z.object({
    cells: z.array(GradingCellSchema).optional(),
    tables: z.array(z.object({
        name: z.string(),
        checkColumns: z.boolean().optional(),
        scoreWeight: z.number(),
    })).optional(),
    charts: z.array(z.object({
        type: z.string().optional(),
        scoreWeight: z.number(),
    })).optional(),
    totalScore: z.number(),
})

// ── Request schemas ───────────────────────────────────────────────────────────

const ProblemBody = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    type: z.string().min(1),
    score: z.number().int().min(1).default(100),
    timeLimit: z.number().int().min(1).optional(),
    templateWorkbook: z.unknown().optional(),
    answerWorkbook: z.unknown().optional(),
    gradingConfig: GradingConfigSchema,
    hints: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
})

const GetProblemsQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    type: z.string().optional(),
    search: z.string().optional(),
    tags: z.string().optional(),
})

// ── XLSX conversion ───────────────────────────────────────────────────────────

function buildXlsxBuffer(data: SerializedWorkbookData): Buffer {
    const wb = XLSX.utils.book_new()
    for (const sheetId of data.sheetOrder) {
        const sheet = data.sheets[sheetId]
        if (!sheet) continue

        let maxRow = 0
        let maxCol = 0
        for (const key of Object.keys(sheet.cells)) {
            const [r, c] = key.split(':').map(Number)
            if (r > maxRow) maxRow = r
            if (c > maxCol) maxCol = c
        }

        const aoa: (string | number | boolean | null)[][] = Array.from(
            { length: maxRow + 1 },
            () => Array(maxCol + 1).fill(null) as (string | number | boolean | null)[],
        )
        for (const [key, cell] of Object.entries(sheet.cells)) {
            const [r, c] = key.split(':').map(Number)
            aoa[r][c] = cell.value
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa)
        XLSX.utils.book_append_sheet(wb, ws, sheet.name)
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const problemRoutes: FastifyPluginAsync = async (app) => {
    app.get('/', async (request) => {
        const query = GetProblemsQuery.parse(request.query)
        const offset = (query.page - 1) * query.limit

        // Optional auth to allow admin to see unpublished problems
        let isAdmin = false
        try {
            const payload = await request.jwtVerify<{ sub: string; role: string }>()
            if (payload.role === 'admin') isAdmin = true
        } catch { /* public access */ }

        const where = and(
            !isAdmin ? eq(problems.isPublished, true) : undefined,
            query.difficulty ? eq(problems.difficulty, query.difficulty) : undefined,
            query.type ? eq(problems.type, query.type) : undefined,
            query.search ? ilike(problems.title, `%${query.search}%`) : undefined,
            query.tags ? sql`${problems.tags} @> ARRAY[${query.tags}]::text[]` : undefined,
        )

        const [{ total }] = await app.db
            .select({ total: count() })
            .from(problems)
            .where(where)

        const rows = await app.db
            .select({
                id: problems.id,
                title: problems.title,
                description: problems.description,
                difficulty: problems.difficulty,
                type: problems.type,
                score: problems.score,
                timeLimit: problems.timeLimit,
                templateWorkbook: problems.templateWorkbook,
                hints: problems.hints,
                tags: problems.tags,
                isPublished: problems.isPublished,
                createdBy: problems.createdBy,
                createdAt: problems.createdAt,
                updatedAt: problems.updatedAt,
            })
            .from(problems)
            .where(where)
            .limit(query.limit)
            .offset(offset)

        return { success: true, data: rows, total, page: query.page }
    })

    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }

        // Optional auth to attach userProgress
        let requestUserId: string | undefined
        try {
            const payload = await request.jwtVerify<{ sub: string; role: string }>()
            requestUserId = payload.sub
        } catch { /* public */ }

        const row = await app.db.query.problems.findFirst({
            where: eq(problems.id, id),
            columns: { answerWorkbook: false, gradingConfig: false },
        })
        if (!row) return reply.status(404).send({ success: false, error: 'Not found', code: 'NOT_FOUND' })

        let progress = null
        if (requestUserId) {
            progress = await app.db.query.userProgress.findFirst({
                where: and(
                    eq(userProgress.userId, requestUserId),
                    eq(userProgress.problemId, id),
                ),
            })
        }

        return { success: true, data: { ...row, progress } }
    })

    app.get('/:id/template-download', async (request, reply) => {
        const { id } = request.params as { id: string }
        const row = await app.db.query.problems.findFirst({
            where: eq(problems.id, id),
            columns: { id: true, title: true, templateWorkbook: true },
        })
        if (!row || !row.templateWorkbook) {
            return reply.status(404).send({ success: false, error: 'Template not found', code: 'NOT_FOUND' })
        }

        const data = row.templateWorkbook as unknown as SerializedWorkbookData
        const buf = buildXlsxBuffer(data)
        const filename = encodeURIComponent(`${row.title}.xlsx`)

        return reply
            .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .header('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
            .send(buf)
    })

    app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        const body = ProblemBody.parse(request.body)
        const [row] = await app.db
            .insert(problems)
            .values({
                ...body,
                gradingConfig: body.gradingConfig,
                createdBy: request.userId,
            })
            .returning()
        return reply.status(201).send({ success: true, data: row })
    })

    app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== 'admin') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
        }
        const { id } = request.params as { id: string }
        const body = ProblemBody.partial().parse(request.body)
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
