import { eq, and, ilike, sql, count } from "drizzle-orm";
import type { DB } from "../../../global/db/index.js";
import { problems, userProgress } from "../../../global/db/schema.js";
import type { GetProblemsQuery, ProblemBody } from "../dto/problem.dto.js";

export const problemRepository = {
    async findAll(db: DB, query: GetProblemsQuery, isAdmin: boolean) {
        const offset = (query.page - 1) * query.limit;

        const where = and(
            !isAdmin ? eq(problems.isPublished, true) : undefined,
            query.difficulty
                ? eq(problems.difficulty, query.difficulty)
                : undefined,
            query.type ? eq(problems.type, query.type) : undefined,
            query.search
                ? ilike(problems.title, `%${query.search}%`)
                : undefined,
            query.tags
                ? sql`${problems.tags} @> ARRAY[${query.tags}]::text[]`
                : undefined,
        );

        const [{ total }] = await db
            .select({ total: count() })
            .from(problems)
            .where(where);

        const rows = await db
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
            .offset(offset);

        return { rows, total };
    },

    async findById(db: DB, id: string) {
        return db.query.problems.findFirst({
            where: eq(problems.id, id),
            columns: { answerWorkbook: false, gradingConfig: false },
        });
    },

    async findByIdWithPrivate(db: DB, id: string) {
        return db.query.problems.findFirst({ where: eq(problems.id, id) });
    },

    async findProgress(db: DB, userId: string, problemId: string) {
        return db.query.userProgress.findFirst({
            where: and(
                eq(userProgress.userId, userId),
                eq(userProgress.problemId, problemId),
            ),
        });
    },

    async create(db: DB, data: ProblemBody & { createdBy: string }) {
        const [row] = await db.insert(problems).values(data).returning();
        return row;
    },

    async update(db: DB, id: string, data: Partial<ProblemBody>) {
        const [row] = await db
            .update(problems)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(problems.id, id))
            .returning();
        return row;
    },

    async delete(db: DB, id: string) {
        await db.delete(problems).where(eq(problems.id, id));
    },
};
