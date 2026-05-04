import type { DB } from "../../../global/db/index.js";
import { submissionRepository } from "../repository/submission.repository.js";
import { gradingService } from "./grading.service.js";
import type { GradingConfig } from "../entity/submission.entity.js";
import { problemRepository } from "../../problem/repository/problem.repository.js";

export const submissionService = {
    async submit(
        db: DB,
        input: {
            userId: string;
            problemId: string;
            workbookData: unknown;
            timeSpentSeconds?: number;
        },
    ) {
        const problem = await problemRepository.findByIdWithPrivate(
            db,
            input.problemId,
        );
        if (!problem) {
            throw Object.assign(new Error("Problem not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }

        const config = problem.gradingConfig as unknown as GradingConfig;

        let gradingResult;
        let status: "graded" | "error" = "graded";
        try {
            gradingResult = await gradingService.grade(
                input.workbookData,
                config,
            );
        } catch {
            gradingResult = {
                totalScore: 0,
                maxScore: config?.totalScore ?? 0,
                percentage: 0,
                status: "fail" as const,
                cellResults: [],
                tableResults: [],
                feedback: "채점 중 오류가 발생했습니다.",
            };
            status = "error";
        }

        const submission = await submissionRepository.create(db, {
            userId: input.userId,
            problemId: input.problemId,
            workbookData: input.workbookData,
            gradingResult,
            status,
            timeSpentSeconds: input.timeSpentSeconds,
        });

        await submissionRepository.upsertProgress(
            db,
            input.userId,
            input.problemId,
            gradingResult.totalScore,
        );

        return { submission, result: gradingResult };
    },

    async findById(db: DB, id: string) {
        return submissionRepository.findById(db, id);
    },

    async findByUser(db: DB, userId: string, page: number, limit: number) {
        return submissionRepository.findByUser(db, userId, page, limit);
    },

    async getProblemStats(db: DB, problemId: string) {
        const stats = await submissionRepository.getProblemStats(db, problemId);
        const total = stats.total;
        const passCount = stats.passCount ?? 0;
        const avgPct = stats.avgPercentage
            ? parseFloat(stats.avgPercentage)
            : 0;
        return {
            total,
            avgPercentage: Math.round(avgPct * 100) / 100,
            passCount,
            passRate:
                total > 0 ? Math.round((passCount / total) * 10000) / 100 : 0,
        };
    },
};
