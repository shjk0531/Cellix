import { Inject, Injectable } from "@nestjs/common";
import { eq, and, sql, count, desc } from "drizzle-orm";
import { DB_TOKEN } from "../../../global/db/db.module.js";
import type { DB } from "../../../global/db/index.js";
import { submissions, userProgress } from "../../../global/db/schema.js";
import type { GradingResult } from "../entity/submission.entity.js";

@Injectable()
export class SubmissionRepository {
    constructor(@Inject(DB_TOKEN) private readonly db: DB) {}

    async create(data: {
        userId: string;
        problemId: string;
        workbookData: unknown;
        gradingResult: GradingResult;
        status: "graded" | "error";
        timeSpentSeconds?: number;
    }) {
        const [row] = await this.db
            .insert(submissions)
            .values({
                userId: data.userId,
                problemId: data.problemId,
                submittedWorkbook: data.workbookData as Record<string, unknown>,
                totalScore: String(data.gradingResult.totalScore),
                maxScore: data.gradingResult.maxScore,
                percentage: String(data.gradingResult.percentage),
                status: data.status,
                feedback: data.gradingResult as unknown as Record<string, unknown>,
                timeSpentSeconds: data.timeSpentSeconds,
            })
            .returning();
        return row;
    }

    async findById(id: string) {
        return this.db.query.submissions.findFirst({
            where: eq(submissions.id, id),
        });
    }

    async findByUser(userId: string, page: number, limit: number) {
        const offset = (page - 1) * limit;
        return this.db
            .select()
            .from(submissions)
            .where(eq(submissions.userId, userId))
            .orderBy(desc(submissions.submittedAt))
            .limit(limit)
            .offset(offset);
    }

    async getProblemStats(problemId: string) {
        const [stats] = await this.db
            .select({
                total: count(),
                avgPercentage: sql<string | null>`avg(${submissions.percentage}::numeric)`,
                passCount: sql<number>`coalesce(sum(case when ${submissions.percentage}::numeric >= 100 then 1 else 0 end), 0)::int`,
            })
            .from(submissions)
            .where(eq(submissions.problemId, problemId));
        return stats;
    }

    async upsertProgress(
        userId: string,
        problemId: string,
        totalScore: number,
    ) {
        const existing = await this.db.query.userProgress.findFirst({
            where: and(
                eq(userProgress.userId, userId),
                eq(userProgress.problemId, problemId),
            ),
        });

        if (existing) {
            const prevBest = parseFloat(existing.bestScore ?? "0");
            await this.db
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
            await this.db.insert(userProgress).values({
                userId,
                problemId,
                attempts: 1,
                lastAttemptAt: new Date(),
                bestScore: String(totalScore),
            });
        }
    }
}