import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { ZodError } from "zod";
import { env } from "./global/config/index.js";
import { dbPlugin, redisPlugin, authPlugin } from "./global/plugins/index.js";
import { authController } from "./domain/auth/index.js";
import { userController } from "./domain/user/index.js";
import { problemController } from "./domain/problem/index.js";
import { submissionController } from "./domain/submission/index.js";
import type { ApiResponse } from "@cellix/shared";

export async function buildApp() {
    const app = Fastify({
        logger:
            env.NODE_ENV === "development"
                ? { transport: { target: "pino-pretty" } }
                : true,
    });

    await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
    await app.register(cookie);
    await app.register(jwt, {
        secret: env.JWT_SECRET ?? "dev-secret-change-in-prod-min32chars!!",
    });
    await app.register(dbPlugin);
    await app.register(redisPlugin);
    await app.register(authPlugin);

    await app.register(authController, { prefix: "/api/auth" });
    await app.register(problemController, { prefix: "/api/problems" });
    await app.register(submissionController, { prefix: "/api/submissions" });
    await app.register(userController, { prefix: "/api/users" });

    app.get(
        "/api/health",
        async (): Promise<ApiResponse<{ status: string; env: string }>> => {
            return { success: true, data: { status: "ok", env: env.NODE_ENV } };
        },
    );

    app.setErrorHandler((error, _request, reply) => {
        if (error instanceof ZodError) {
            return reply.status(422).send({
                success: false,
                error: error.errors[0]?.message ?? "Validation error",
                code: "VALIDATION_ERROR",
            });
        }
        app.log.error(error);
        const httpError = error as {
            statusCode?: number;
            message: string;
            code?: string;
        };
        if (
            typeof httpError.statusCode === "number" &&
            httpError.statusCode < 500
        ) {
            return reply.status(httpError.statusCode).send({
                success: false,
                error: httpError.message,
                code: httpError.code ?? "VALIDATION_ERROR",
            });
        }
        return reply.status(500).send({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR",
        });
    });

    return app;
}
