import { Body, Controller, Get, Post } from "@nestjs/common";
import type { GradingConfig } from "@cellix/shared";
import { GradingService } from "./grading.service.js";
import { env } from "./config/env.js";

@Controller()
export class GradingController {
    constructor(private readonly gradingService: GradingService) {}

    @Get("api/grading/health")
    health() {
        return { status: "ok", service: "grading", env: env.NODE_ENV };
    }

    @Post("internal/grade")
    grade(
        @Body()
        body: {
            workbookData: unknown;
            config: GradingConfig;
        },
    ) {
        return this.gradingService.grade(body.workbookData, body.config);
    }
}
