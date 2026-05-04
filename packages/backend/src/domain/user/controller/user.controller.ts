import type { FastifyPluginAsync } from "fastify";
import { UpdateMeBodyDto, PaginationQueryDto } from "../dto/user.dto.js";
import { userService } from "../service/user.service.js";

export const userController: FastifyPluginAsync = async (app) => {
    app.get(
        "/me",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const user = await userService.getMe(app.db, request.userId);
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

    app.patch("/me", { preHandler: [app.authenticate] }, async (request) => {
        const body = UpdateMeBodyDto.parse(request.body);
        const user = await userService.updateMe(app.db, request.userId, body);
        return { success: true, data: user };
    });

    app.get(
        "/me/progress",
        { preHandler: [app.authenticate] },
        async (request) => {
            const rows = await userService.getProgress(app.db, request.userId);
            return { success: true, data: rows };
        },
    );

    app.get(
        "/me/submissions",
        { preHandler: [app.authenticate] },
        async (request) => {
            const query = PaginationQueryDto.parse(request.query);
            const rows = await userService.getSubmissions(
                app.db,
                request.userId,
                query.page,
                query.limit,
            );
            return { success: true, data: rows };
        },
    );

    app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.userRole !== "admin") {
            return reply.status(403).send({
                success: false,
                error: "Forbidden",
                code: "FORBIDDEN",
            });
        }
        const rows = await userService.getAllUsers(app.db);
        return { success: true, data: rows };
    });
};
