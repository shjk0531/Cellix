import type { FastifyPluginAsync } from "fastify";
import { RegisterBodyDto, LoginBodyDto } from "../dto/auth.dto.js";
import { authService } from "../service/auth.service.js";

const ACCESS_TOKEN_EXPIRES = "1h";
const REFRESH_TOKEN_EXPIRES_SEC = 7 * 24 * 60 * 60;
const COOKIE_NAME = "refreshToken";
const COOKIE_OPTS = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: false,
};

export const authController: FastifyPluginAsync = async (app) => {
    app.post("/register", async (request, reply) => {
        const body = RegisterBodyDto.parse(request.body);
        const user = await authService.register(app.db, body);
        return reply.status(201).send({ success: true, data: { user } });
    });

    app.post("/login", async (request, reply) => {
        const body = LoginBodyDto.parse(request.body);
        const user = await authService.login(app.db, body);

        const accessToken = app.jwt.sign(
            { sub: user.id, role: user.role },
            { expiresIn: ACCESS_TOKEN_EXPIRES },
        );

        const refreshToken = crypto.randomUUID();
        await app.redis.setex(
            `refresh:${refreshToken}`,
            REFRESH_TOKEN_EXPIRES_SEC,
            user.id,
        );
        reply.setCookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);

        return { success: true, data: { accessToken, user } };
    });

    app.post("/refresh", async (request, reply) => {
        const token = request.cookies[COOKIE_NAME];
        if (!token) {
            return reply.status(401).send({
                success: false,
                error: "No refresh token",
                code: "UNAUTHORIZED",
            });
        }

        const userId = await app.redis.get(`refresh:${token}`);
        if (!userId) {
            return reply.status(401).send({
                success: false,
                error: "Invalid or expired refresh token",
                code: "UNAUTHORIZED",
            });
        }

        const user = await authService.findById(app.db, userId);
        if (!user) {
            return reply.status(401).send({
                success: false,
                error: "User not found",
                code: "UNAUTHORIZED",
            });
        }

        await app.redis.del(`refresh:${token}`);
        const newRefreshToken = crypto.randomUUID();
        await app.redis.setex(
            `refresh:${newRefreshToken}`,
            REFRESH_TOKEN_EXPIRES_SEC,
            user.id,
        );
        reply.setCookie(COOKIE_NAME, newRefreshToken, COOKIE_OPTS);

        const accessToken = app.jwt.sign(
            { sub: user.id, role: user.role },
            { expiresIn: ACCESS_TOKEN_EXPIRES },
        );

        return { success: true, data: { accessToken, user } };
    });

    app.post("/logout", async (request, reply) => {
        const token = request.cookies[COOKIE_NAME];
        if (token) {
            await app.redis.del(`refresh:${token}`);
        }
        reply.clearCookie(COOKIE_NAME, { path: "/" });
        return { success: true, data: null };
    });

    app.get(
        "/me",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const user = await authService.findById(app.db, request.userId);
            if (!user) {
                return reply.status(404).send({
                    success: false,
                    error: "Not found",
                    code: "NOT_FOUND",
                });
            }
            return { success: true, data: user };
        },
    );
};
