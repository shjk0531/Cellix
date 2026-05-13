import {
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { SubmissionRepository } from "../repository/submission.repository.js";
import { GradingService } from "./grading.service.js";
import type { GradingConfig } from "../entity/submission.entity.js";
import { ProblemRepository } from "../../problem/repository/problem.repository.js";

@Injectable()
export class SubmissionService {
    constructor(
        @Inject(SubmissionRepository)
        private readonly submissionRepository: SubmissionRepository,
        @Inject(GradingService)
        private readonly gradingService: GradingService,
        @Inject(ProblemRepository)
        private readonly problemRepository: ProblemRepository,
    ) {}

    async submit(input: {
        userId: string;
        problemId: string;
        workbookData: unknown;
        timeSpentSeconds?: number;
    }) {
        const problem = await this.problemRepository.findByIdWithPrivate(
            input.problemId,
        );
        if (!problem) {
            throw new NotFoundException({
                error: "Problem not found",
                code: "NOT_FOUND",
            });
        }

        const config = problem.gradingConfig as unknown as GradingConfig;

        let gradingResult;
        let status: "graded" | "error" = "graded";
        try {
            gradingResult = await this.gradingService.grade(
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
                feedback: "Grading failed.",
            };
            status = "error";
        }

        const submission = await this.submissionRepository.create({
            userId: input.userId,
            problemId: input.problemId,
            workbookData: input.workbookData,
            gradingResult,
            status,
            timeSpentSeconds: input.timeSpentSeconds,
        });

        await this.submissionRepository.upsertProgress(
            input.userId,
            input.problemId,
            gradingResult.totalScore,
        );

        return { submission, result: gradingResult };
    }

    async findById(id: string) {
        return this.submissionRepository.findById(id);
    }

    async findByUser(userId: string, page: number, limit: number) {
        return this.submissionRepository.findByUser(userId, page, limit);
    }

    async getProblemStats(problemId: string) {
        const stats = await this.submissionRepository.getProblemStats(problemId);
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
    }

    assertCanRead(
        row: { userId: string },
        user: { id: string; role: string },
    ): void {
        if (row.userId !== user.id && user.role !== "admin") {
            throw new ForbiddenException({
                error: "Forbidden",
                code: "FORBIDDEN",
            });
        }
    }
}
