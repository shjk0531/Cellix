import {
    Body,
    Controller,
    Get,
    Inject,
    NotFoundException,
    Patch,
    Query,
    UseGuards,
} from "@nestjs/common";
import { UpdateMeBodyDto, PaginationQueryDto } from "../dto/user.dto.js";
import type { PaginationQuery, UpdateMeBody } from "../dto/user.dto.js";
import { UserService } from "../service/user.service.js";
import { AdminGuard, AuthUser, JwtAuthGuard, type AuthUser as AuthUserType } from "../../../global/security/index.js";
import { ZodValidationPipe } from "../../../global/common/index.js";

@Controller("api/users")
@UseGuards(JwtAuthGuard)
export class UserController {
    constructor(
        @Inject(UserService)
        private readonly userService: UserService,
    ) {}

    @Get("me")
    async me(@AuthUser() authUser: AuthUserType) {
        const user = await this.userService.getMe(authUser.id);
        if (!user) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }
        return user;
    }

    @Patch("me")
    async updateMe(
        @AuthUser() authUser: AuthUserType,
        @Body(new ZodValidationPipe(UpdateMeBodyDto)) body: UpdateMeBody,
    ) {
        return this.userService.updateMe(authUser.id, body);
    }

    @Get("me/progress")
    getProgress(@AuthUser() authUser: AuthUserType) {
        return this.userService.getProgress(authUser.id);
    }

    @Get("me/submissions")
    getSubmissions(
        @AuthUser() authUser: AuthUserType,
        @Query(new ZodValidationPipe(PaginationQueryDto)) query: PaginationQuery,
    ) {
        return this.userService.getSubmissions(authUser.id, query.page, query.limit);
    }

    @Get()
    @UseGuards(AdminGuard)
    getAllUsers() {
        return this.userService.getAllUsers();
    }
}
