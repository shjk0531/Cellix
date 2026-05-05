import {
    eq,
    and,
    ilike,
    sql,
    count,
    desc,
    asc,
} from "drizzle-orm";
import type { DB } from "../../../global/db/index.js";
import { problems, userProgress, bookmarks } from "../../../global/db/schema.js";
import type { GetProblemsQuery, ProblemBody } from "../dto/problem.dto.js";

type SortField = "newest" | "vote" | "view" | "acceptance" | "difficulty";

function buildOrderBy(sortBy: SortField) {
    switch (sortBy) {
        case "vote":
            return [desc(problems.voteUp)];
        case "view":
            return [desc(problems.viewCount)];
        case "acceptance":
            return [desc(problems.acceptanceRate)];
        case "difficulty":
            return [asc(problems.level)];
        case "newest":
        default:
            return [desc(problems.createdAt)];
    }
}

export const problemRepository = {
    async findAll(
        db: DB,
        query: GetProblemsQuery,
        options: { isAdmin: boolean; userId?: string },
    ) {
        const { isAdmin, userId } = options;
        const offset = (query.page - 1) * query.limit;

        const conditions = [
            // 일반 사용자는 published 문제만, admin은 전체
            !isAdmin ? eq(problems.status, "published") : undefined,
            // 내 문제만 조회 (myOnly=true일 때 userId 필수)
            query.myOnly && userId ? eq(problems.createdBy, userId) : undefined,
            query.difficulty
                ? eq(problems.difficulty, query.difficulty)
                : undefined,
            query.level ? eq(problems.level, query.level) : undefined,
            query.type ? eq(problems.type, query.type) : undefined,
            query.sourceType
                ? eq(problems.sourceType, query.sourceType)
                : undefined,
            query.category
                ? eq(problems.category, query.category)
                : undefined,
            // admin이 status 필터를 직접 지정한 경우
            isAdmin && query.status
                ? eq(problems.status, query.status)
                : undefined,
            query.search
                ? ilike(problems.title, `%${query.search}%`)
                : undefined,
            query.tags
                ? sql`${problems.tags} @> ARRAY[${query.tags.split(",")}]::text[]`
                : undefined,
        ].filter(Boolean);

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [{ total }] = await db
            .select({ total: count() })
            .from(problems)
            .where(where);

        const orderBy = buildOrderBy(query.sortBy);

        // bookmarked 필터: userId가 있을 때만 bookmark join
        if (query.bookmarked && userId) {
            const bookmarkedIds = await db
                .select({ problemId: bookmarks.problemId })
                .from(bookmarks)
                .where(eq(bookmarks.userId, userId));
            const ids = bookmarkedIds.map((b) => b.problemId);
            if (ids.length === 0) return { rows: [], total: 0 };

            const rows = await db
                .select()
                .from(problems)
                .where(
                    and(
                        where,
                        sql`${problems.id} = ANY(ARRAY[${ids}]::uuid[])`,
                    ),
                )
                .orderBy(...orderBy)
                .limit(query.limit)
                .offset(offset);

            return { rows, total };
        }

        const rows = await db
            .select({
                id: problems.id,
                title: problems.title,
                description: problems.description,
                difficulty: problems.difficulty,
                level: problems.level,
                type: problems.type,
                sourceType: problems.sourceType,
                category: problems.category,
                stepLevel: problems.stepLevel,
                status: problems.status,
                score: problems.score,
                timeLimit: problems.timeLimit,
                estimatedMinutes: problems.estimatedMinutes,
                hints: problems.hints,
                tags: problems.tags,
                voteUp: problems.voteUp,
                voteDown: problems.voteDown,
                viewCount: problems.viewCount,
                acceptanceRate: problems.acceptanceRate,
                solveCount: problems.solveCount,
                isPublished: problems.isPublished,
                createdBy: problems.createdBy,
                createdAt: problems.createdAt,
                updatedAt: problems.updatedAt,
            })
            .from(problems)
            .where(where)
            .orderBy(...orderBy)
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

    async incrementViewCount(db: DB, id: string) {
        await db
            .update(problems)
            .set({ viewCount: sql`${problems.viewCount} + 1` })
            .where(eq(problems.id, id));
    },

    async adjustVote(
        db: DB,
        id: string,
        delta: { up?: number; down?: number },
    ) {
        await db
            .update(problems)
            .set({
                voteUp: delta.up
                    ? sql`${problems.voteUp} + ${delta.up}`
                    : problems.voteUp,
                voteDown: delta.down
                    ? sql`${problems.voteDown} + ${delta.down}`
                    : problems.voteDown,
                updatedAt: new Date(),
            })
            .where(eq(problems.id, id));
    },
};
