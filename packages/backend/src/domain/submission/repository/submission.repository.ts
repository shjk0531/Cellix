import { eq, and, sql, count, desc } from "drizzle-orm";
import type { DB } from "../../../global/db/index.js";
import { submissions, userProgress } from "../../../global/db/schema.js";
import type { GradingResult } from "../entity/submission.entity.js";

export const submissionRepository = {
    async create(
        db: DB,
        data: {
            userId: string;
            problemId: string;
            workbookData: unknown;
            gradingResult: GradingResult;
            status: "graded" | "error";
            timeSpentSeconds?: number;
        },
    ) {
        const [row] = await db
            .insert(submissions)
            .values({
                userId: data.userId,
                problemId: data.problemId,
                submittedWorkbook: data.workbookData as Record<string, unknown>,
                totalScore: String(data.gradingResult.totalScore),
                maxScore: data.gradingResult.maxScore,
                percentage: String(data.gradingResult.percentage),
                status: data.status,
                feedback: data.gradingResult as unknown as Record<
                    string,
                    unknown
                >,
                timeSpentSeconds: data.timeSpentSeconds,
            })
            .returning();
        return row;
    },

    async findById(db: DB, id: string) {
        return db.query.submissions.findFirst({
            where: eq(submissions.id, id),
        });
    },

    async findByUser(db: DB, userId: string, page: number, limit: number) {
        const offset = (page - 1) * limit;
        return db
            .select()
            .from(submissions)
            .where(eq(submissions.userId, userId))
            .orderBy(desc(submissions.submittedAt))
            .limit(limit)
            .offset(offset);
    },

    async getProblemStats(db: DB, problemId: string) {
        const [stats] = await db
            .select({
                total: count(),
                avgPercentage: sql<
                    string | null
                >`avg(${submissions.percentage}::numeric)`,
                passCount: sql<number>`coalesce(sum(case when ${submissions.percentage}::numeric >= 100 then 1 else 0 end), 0)::int`,
            })
            .from(submissions)
            .where(eq(submissions.problemId, problemId));
        return stats;
    },

    async upsertProgress(
        db: DB,
        userId: string,
        problemId: string,
        totalScore: number,
    ) {
        const existing = await db.query.userProgress.findFirst({
            where: and(
                eq(userProgress.userId, userId),
                eq(userProgress.problemId, problemId),
            ),
        });

        if (existing) {
            const prevBest = parseFloat(existing.bestScore ?? "0");
            await db
                .update(userProgress)
                .set({
                    attempts: existing.attempts + 1,
                    lastAttemptAt: new Date(),
                    bestScore:
                        totalScore > prevBest
                            ? String(totalScore)
                            : existing.bestScore,
                })
                .where(
                    and(
                        eq(userProgress.userId, userId),
                        eq(userProgress.problemId, problemId),
                    ),
                );
        } else {
            await db.insert(userProgress).values({
                userId,
                problemId,
                attempts: 1,
                lastAttemptAt: new Date(),
                bestScore: String(totalScore),
            });
        }
    },
};
