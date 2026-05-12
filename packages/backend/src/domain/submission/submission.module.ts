import { Module } from "@nestjs/common";
import { ProblemModule } from "../problem/problem.module.js";
import { SubmissionController } from "./controller/submission.controller.js";
import { SubmissionRepository } from "./repository/submission.repository.js";
import { GradingService } from "./service/grading.service.js";
import { SubmissionService } from "./service/submission.service.js";

@Module({
    imports: [ProblemModule],
    controllers: [SubmissionController],
    providers: [GradingService, SubmissionRepository, SubmissionService],
})
export class SubmissionModule {}