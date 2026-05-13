import { z } from "zod";
import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Inject,
    NotFoundException,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseGuards,
} from "@nestjs/common";
import { ProblemBodyDto, GetProblemsQueryDto } from "../dto/problem.dto.js";
import type { GetProblemsQuery, ProblemBody } from "../dto/problem.dto.js";
import { ProblemService } from "../service/problem.service.js";
import {
    AdminGuard,
    AuthUser,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    type AuthUser as AuthUserType,
} from "../../../global/security/index.js";
import { ZodValidationPipe } from "../../../global/common/index.js";

const ReviewBodyDto = z.object({
    verdict: z.enum(["published", "rejected"]),
    reviewNote: z.string().optional(),
});

type ReviewBody = z.infer<typeof ReviewBodyDto>;

@Controller("api/problems")
export class ProblemController {
    constructor(
        @Inject(ProblemService)
        private readonly problemService: ProblemService,
    ) {}

    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    async findAll(
        @Query(new ZodValidationPipe(GetProblemsQueryDto))
        query: GetProblemsQuery,
        @AuthUser() user?: AuthUserType,
    ) {
        const { rows, total } = await this.problemService.findAll(query, {
            isAdmin: user?.role === "admin",
            userId: user?.id,
        });
        return { success: true, data: rows, total, page: query.page };
    }

    @Get(":id")
    @UseGuards(OptionalJwtAuthGuard)
    async findById(@Param("id") id: string, @AuthUser() user?: AuthUserType) {
        const result = await this.problemService.findById(id, user?.id);
        if (!result) {
            throw new NotFoundException({
                error: "Not found",
                code: "NOT_FOUND",
            });
        }
        return result;
    }

    @Get(":id/template-download")
    @Header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    async downloadTemplate(@Param("id") id: string) {
        const result = await this.problemService.getTemplateXlsx(id);
        if (!result) {
            throw new NotFoundException({
                error: "Template not found",
                code: "NOT_FOUND",
            });
        }
        return result.buffer;
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(
        @Body(new ZodValidationPipe(ProblemBodyDto)) body: ProblemBody,
        @AuthUser() user: AuthUserType,
    ) {
        return this.problemService.create(body, user.id, user.role);
    }

    @Put(":id")
    @UseGuards(JwtAuthGuard)
    update(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(ProblemBodyDto.partial()))
        body: Partial<ProblemBody>,
        @AuthUser() user: AuthUserType,
    ) {
        return this.problemService.update(id, body, user.id, user.role);
    }

    @Delete(":id")
    @UseGuards(JwtAuthGuard)
    async delete(@Param("id") id: string, @AuthUser() user: AuthUserType) {
        await this.problemService.delete(id, user.id, user.role);
        return null;
    }

    @Post(":id/submit-review")
    @UseGuards(JwtAuthGuard)
    submitForReview(@Param("id") id: string, @AuthUser() user: AuthUserType) {
        return this.problemService.submitForReview(id, user.id);
    }

    @Patch(":id/review")
    @UseGuards(JwtAuthGuard, AdminGuard)
    review(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(ReviewBodyDto)) body: ReviewBody,
    ) {
        return this.problemService.reviewProblem(
            id,
            body.verdict,
            body.reviewNote,
        );
    }
}
