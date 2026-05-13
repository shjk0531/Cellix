import { Inject, Injectable } from "@nestjs/common";
import {
    eq,
    and,
    ilike,
    sql,
    count,
    desc,
    asc,
    inArray,
} from "drizzle-orm";
import { DB_TOKEN } from "../../../global/db/db.module.js";
import type { DB } from "../../../global/db/index.js";
import { problems, userProgress, bookmarks } from "../../../global/db/schema.js";
import type { GetProblemsQuery, ProblemBody } from "../dto/problem.dto.js";

type SortField = "newest" | "vote" | "view" | "acceptance" | "difficulty";

const publicProblemColumns = {
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
};

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

@Injectable()
export class ProblemRepository {
    constructor(@Inject(DB_TOKEN) private readonly db: DB) {}

    async findAll(
        query: GetProblemsQuery,
        options: { isAdmin: boolean; userId?: string },
    ) {
        const { isAdmin, userId } = options;
        const offset = (query.page - 1) * query.limit;

        const conditions = [
            // ?¼ë°˜ ?¬ìš©?ëŠ” published ë¬¸ì œë§? admin?€ ?„ì²´
            !isAdmin ? eq(problems.status, "published") : undefined,
            // ??ë¬¸ì œë§?ì¡°íšŒ (myOnly=true????userId ?„ìˆ˜)
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
            // admin??status ?„í„°ë¥?ì§ì ‘ ì§€?•í•œ ê²½ìš°
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

        const [{ total }] = await this.db
            .select({ total: count() })
            .from(problems)
            .where(where);

        const orderBy = buildOrderBy(query.sortBy);

        // bookmarked ?„í„°: userIdê°€ ?ˆì„ ?Œë§Œ bookmark join
        if (query.bookmarked && userId) {
            const bookmarkedIds = await this.db
                .select({ problemId: bookmarks.problemId })
                .from(bookmarks)
                .where(eq(bookmarks.userId, userId));
            const ids = bookmarkedIds.map((b) => b.problemId);
            if (ids.length === 0) return { rows: [], total: 0 };

            const bookmarkedWhere = where
                ? and(where, inArray(problems.id, ids))
                : inArray(problems.id, ids);

            const [{ total: bookmarkedTotal }] = await this.db
                .select({ total: count() })
                .from(problems)
                .where(bookmarkedWhere);

            const rows = await this.db
                .select(publicProblemColumns)
                .from(problems)
                .where(bookmarkedWhere)
                .orderBy(...orderBy)
                .limit(query.limit)
                .offset(offset);

            return { rows, total: bookmarkedTotal };
        }

        const rows = await this.db
            .select(publicProblemColumns)
            .from(problems)
            .where(where)
            .orderBy(...orderBy)
            .limit(query.limit)
            .offset(offset);

        return { rows, total };
    }

    async findById(id: string) {
        return this.db.query.problems.findFirst({
            where: eq(problems.id, id),
            columns: { answerWorkbook: false, gradingConfig: false },
        });
    }

    async findByIdWithPrivate(id: string) {
        return this.db.query.problems.findFirst({ where: eq(problems.id, id) });
    }

    async findProgress(userId: string, problemId: string) {
        return this.db.query.userProgress.findFirst({
            where: and(
                eq(userProgress.userId, userId),
                eq(userProgress.problemId, problemId),
            ),
        });
    }

    async create(data: ProblemBody & { createdBy: string }) {
        const [row] = await this.db.insert(problems).values(data).returning();
        return row;
    }

    async update(id: string, data: Partial<ProblemBody>) {
        const [row] = await this.db
            .update(problems)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(problems.id, id))
            .returning();
        return row;
    }

    async delete(id: string) {
        await this.db.delete(problems).where(eq(problems.id, id));
    }

    async incrementViewCount(id: string) {
        await this.db
            .update(problems)
            .set({ viewCount: sql`${problems.viewCount} + 1` })
            .where(eq(problems.id, id));
    }

    async adjustVote(
        id: string,
        delta: { up?: number; down?: number },
    ) {
        await this.db
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
    }
}
