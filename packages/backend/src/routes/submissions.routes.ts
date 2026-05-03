import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq, and, sql, count, desc } from "drizzle-orm";
import { submissions, userProgress, problems } from "../db/schema.js";
import { gradingService, type GradingConfig } from "../services/index.js";

const SubmitBody = z.object({
    problemId: z.string().uuid(),
    workbookData: z.unknown(),
    timeSpentSeconds: z.number().int().min(0).optional(),
});

const PaginationQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const submissionRoutes: FastifyPluginAsync = async (app) => {
    // ── 제출 + 즉시 채점 ────────────────────────────────────────────────────────
    app.post(
        "/",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const body = SubmitBody.parse(request.body);

            // 문제 조회 (answerWorkbook, gradingConfig 포함)
            const problem = await app.db.query.problems.findFirst({
                where: eq(problems.id, body.problemId),
            });
            if (!problem) {
                return reply
                    .status(404)
                    .send({
                        success: false,
                        error: "Problem not found",
                        code: "NOT_FOUND",
                    });
            }

            const config = problem.gradingConfig as unknown as GradingConfig;

            // 채점 (deserializeWorkbook은 grading.service 내부에서 호출)
            let gradingResult;
            let submissionStatus: "graded" | "error" = "graded";
            try {
                gradingResult = await gradingService.grade(
                    body.workbookData,
                    config,
                );
            } catch (err) {
                app.log.error({ err }, "Grading failed");
                gradingResult = {
                    totalScore: 0,
                    maxScore: config?.totalScore ?? 0,
                    percentage: 0,
                    status: "fail" as const,
                    cellResults: [],
                    tableResults: [],
                    feedback: "채점 중 오류가 발생했습니다.",
                };
                submissionStatus = "error";
            }

            // DB 저장
            const [row] = await app.db
                .insert(submissions)
                .values({
                    userId: request.userId,
                    problemId: body.problemId,
                    submittedWorkbook: body.workbookData as Record<
                        string,
                        unknown
                    >,
                    totalScore: String(gradingResult.totalScore),
                    maxScore: gradingResult.maxScore,
                    percentage: String(gradingResult.percentage),
                    status: submissionStatus,
                    feedback: gradingResult as unknown as Record<
                        string,
                        unknown
                    >,
                    timeSpentSeconds: body.timeSpentSeconds,
                })
                .returning();

            // userProgress upsert (best_score 갱신)
            const existing = await app.db.query.userProgress.findFirst({
                where: and(
                    eq(userProgress.userId, request.userId),
                    eq(userProgress.problemId, body.problemId),
                ),
            });
            if (existing) {
                const prevBest = parseFloat(existing.bestScore ?? "0");
                await app.db
                    .update(userProgress)
                    .set({
                        attempts: existing.attempts + 1,
                        lastAttemptAt: new Date(),
                        bestScore:
                            gradingResult.totalScore > prevBest
                                ? String(gradingResult.totalScore)
                                : existing.bestScore,
                    })
                    .where(
                        and(
                            eq(userProgress.userId, request.userId),
                            eq(userProgress.problemId, body.problemId),
                        ),
                    );
            } else {
                await app.db.insert(userProgress).values({
                    userId: request.userId,
                    problemId: body.problemId,
                    attempts: 1,
                    lastAttemptAt: new Date(),
                    bestScore: String(gradingResult.totalScore),
                });
            }

            return reply.status(201).send({
                success: true,
                data: { submission: row, result: gradingResult },
            });
        },
    );

    // ── 제출 단건 조회 ────────────────────────────────────────────────────────────
    app.get(
        "/:id",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const row = await app.db.query.submissions.findFirst({
                where: eq(submissions.id, id),
            });
            if (!row)
                return reply
                    .status(404)
                    .send({
                        success: false,
                        error: "Not found",
                        code: "NOT_FOUND",
                    });
            if (row.userId !== request.userId && request.userRole !== "admin") {
                return reply
                    .status(403)
                    .send({
                        success: false,
                        error: "Forbidden",
                        code: "FORBIDDEN",
                    });
            }
            return { success: true, data: row };
        },
    );

    // ── 내 제출 목록 ─────────────────────────────────────────────────────────────
    app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
        const query = PaginationQuery.parse(request.query);
        const offset = (query.page - 1) * query.limit;
        const rows = await app.db
            .select()
            .from(submissions)
            .where(eq(submissions.userId, request.userId))
            .orderBy(desc(submissions.submittedAt))
            .limit(query.limit)
            .offset(offset);
        return { success: true, data: rows };
    });

    // ── 문제별 통계 [admin] ───────────────────────────────────────────────────────
    app.get(
        "/problem/:problemId/stats",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            if (request.userRole !== "admin") {
                return reply
                    .status(403)
                    .send({
                        success: false,
                        error: "Forbidden",
                        code: "FORBIDDEN",
                    });
            }
            const { problemId } = request.params as { problemId: string };

            const [stats] = await app.db
                .select({
                    total: count(),
                    avgPercentage: sql<
                        string | null
                    >`avg(${submissions.percentage}::numeric)`,
                    passCount: sql<number>`coalesce(sum(case when ${submissions.percentage}::numeric >= 100 then 1 else 0 end), 0)::int`,
                })
                .from(submissions)
                .where(eq(submissions.problemId, problemId));

            const total = stats.total;
            const passCount = stats.passCount ?? 0;
            const avgPct = stats.avgPercentage
                ? parseFloat(stats.avgPercentage)
                : 0;

            return {
                success: true,
                data: {
                    total,
                    avgPercentage: Math.round(avgPct * 100) / 100,
                    passCount,
                    passRate:
                        total > 0
                            ? Math.round((passCount / total) * 10000) / 100
                            : 0,
                },
            };
        },
    );
};
