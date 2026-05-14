import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    Inject,
    NotFoundException,
    Post,
    Res,
    UnauthorizedException,
    UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Redis } from "ioredis";
import { AuthService } from "./auth.service.js";
import { LoginBodyDto, RegisterBodyDto, type LoginBody, type RegisterBody } from "./dto/auth.dto.js";
import { AuthUser, type AuthUser as AuthUserType } from "./auth-user.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { parseCookie, serializeCookie } from "./common/cookie.js";
import { ZodValidationPipe } from "./common/zod-validation.pipe.js";
import { REDIS_TOKEN } from "./redis/redis.module.js";

const ACCESS_TOKEN_EXPIRES = "1h";
const REFRESH_TOKEN_EXPIRES_SEC = 7 * 24 * 60 * 60;
const COOKIE_NAME = "refreshToken";

@Controller("api/auth")
export class AuthController {
    constructor(
        @Inject(AuthService)
        private readonly authService: AuthService,
        @Inject(JwtService)
        private readonly jwtService: JwtService,
        @Inject(REDIS_TOKEN)
        private readonly redis: Redis,
    ) {}

    @Post("register")
    async register(
        @Body(new ZodValidationPipe(RegisterBodyDto)) body: RegisterBody,
        @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
    ) {
        const user = await this.authService.register(body);
        const accessToken = await this.issueRefreshSession(user, response);
        return { accessToken, user };
    }

    @Post("login")
    @HttpCode(200)
    async login(
        @Body(new ZodValidationPipe(LoginBodyDto)) body: LoginBody,
        @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
    ) {
        const user = await this.authService.login(body);
        const accessToken = await this.issueRefreshSession(user, response);
        return { accessToken, user };
    }

    @Post("refresh")
    @HttpCode(200)
    async refresh(
        @Headers("cookie") cookieHeader: string | undefined,
        @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
    ) {
        const token = parseCookie(cookieHeader)[COOKIE_NAME];
        if (!token) {
            throw new UnauthorizedException({
                error: "No refresh token",
                code: "UNAUTHORIZED",
            });
        }

        const userId = await this.redis.get(`refresh:${token}`);
        if (!userId) {
            throw new UnauthorizedException({
                error: "Invalid or expired refresh token",
                code: "UNAUTHORIZED",
            });
        }

        const user = await this.authService.findById(userId);
        if (!user) {
            throw new UnauthorizedException({
                error: "User not found",
                code: "UNAUTHORIZED",
            });
        }

        await this.redis.del(`refresh:${token}`);
        const accessToken = await this.issueRefreshSession(user, response);
        return { accessToken, user };
    }

    @Post("logout")
    @HttpCode(200)
    async logout(
        @Headers("cookie") cookieHeader: string | undefined,
        @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
    ) {
        const token = parseCookie(cookieHeader)[COOKIE_NAME];
        if (token) await this.redis.del(`refresh:${token}`);
        response.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, "", 0));
        return null;
    }

    @Get("me")
    @UseGuards(JwtAuthGuard)
    async me(@AuthUser() authUser: AuthUserType) {
        const user = await this.authService.findById(authUser.id);
        if (!user) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }
        return user;
    }

    private signAccessToken(user: { id: string; role: string }) {
        return this.jwtService.signAsync(
            { sub: user.id, role: user.role },
            { expiresIn: ACCESS_TOKEN_EXPIRES },
        );
    }

    private async issueRefreshSession(
        user: { id: string; role: string },
        response: { setHeader: (name: string, value: string) => void },
    ) {
        const accessToken = await this.signAccessToken(user);
        const refreshToken = crypto.randomUUID();
        await this.redis.setex(
            `refresh:${refreshToken}`,
            REFRESH_TOKEN_EXPIRES_SEC,
            user.id,
        );
        response.setHeader(
            "Set-Cookie",
            serializeCookie(COOKIE_NAME, refreshToken, REFRESH_TOKEN_EXPIRES_SEC),
        );
        return accessToken;
    }
}
