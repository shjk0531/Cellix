import { Module } from "@nestjs/common";
import { ProblemModule } from "../problem/problem.module.js";
import { SubmissionController } from "./controller/submission.controller.js";
import { SubmissionRepository } from "./repository/submission.repository.js";
import { GradingClientService } from "./service/grading-client.service.js";
import { SubmissionService } from "./service/submission.service.js";

@Module({
    imports: [ProblemModule],
    controllers: [SubmissionController],
    providers: [GradingClientService, SubmissionRepository, SubmissionService],
})
export class SubmissionModule {}
