import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Query,
    UseGuards,
} from "@nestjs/common";
import { SubmitBodyDto, PaginationQueryDto } from "../dto/submission.dto.js";
import type { PaginationQuery, SubmitBody } from "../dto/submission.dto.js";
import { SubmissionService } from "../service/submission.service.js";
import {
    AdminGuard,
    AuthUser,
    JwtAuthGuard,
    type AuthUser as AuthUserType,
} from "../../../global/security/index.js";
import { ZodValidationPipe } from "../../../global/common/index.js";

@Controller("api/submissions")
@UseGuards(JwtAuthGuard)
export class SubmissionController {
    constructor(private readonly submissionService: SubmissionService) {}

    @Post()
    submit(
        @AuthUser() user: AuthUserType,
        @Body(new ZodValidationPipe(SubmitBodyDto)) body: SubmitBody,
    ) {
        return this.submissionService.submit({
            userId: user.id,
            problemId: body.problemId,
            workbookData: body.workbookData,
            timeSpentSeconds: body.timeSpentSeconds,
        });
    }

    @Get("me")
    findMine(
        @AuthUser() user: AuthUserType,
        @Query(new ZodValidationPipe(PaginationQueryDto)) query: PaginationQuery,
    ) {
        return this.submissionService.findByUser(
            user.id,
            query.page,
            query.limit,
        );
    }

    @Get("problem/:problemId/stats")
    @UseGuards(AdminGuard)
    getProblemStats(@Param("problemId") problemId: string) {
        return this.submissionService.getProblemStats(problemId);
    }

    @Get(":id")
    async findById(@Param("id") id: string, @AuthUser() user: AuthUserType) {
        const row = await this.submissionService.findById(id);
        if (!row) {
            throw new NotFoundException({
                error: "Not found",
                code: "NOT_FOUND",
            });
        }
        this.submissionService.assertCanRead(row, user);
        return row;
    }
}
