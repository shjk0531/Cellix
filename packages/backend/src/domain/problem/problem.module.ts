import { Module } from "@nestjs/common";
import { ProblemController } from "./controller/problem.controller.js";
import { ProblemRepository } from "./repository/problem.repository.js";
import { ProblemService } from "./service/problem.service.js";

@Module({
    controllers: [ProblemController],
    providers: [ProblemRepository, ProblemService],
    exports: [ProblemRepository, ProblemService],
})
export class ProblemModule {}
