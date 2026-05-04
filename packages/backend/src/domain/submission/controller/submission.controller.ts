import type { FastifyPluginAsync } from "fastify";
import { SubmitBodyDto, PaginationQueryDto } from "../dto/submission.dto.js";
import { submissionService } from "../service/submission.service.js";

export const submissionController: FastifyPluginAsync = async (app) => {
    app.post(
        "/",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const body = SubmitBodyDto.parse(request.body);
            const { submission, result } = await submissionService.submit(
                app.db,
                {
                    userId: request.userId,
                    problemId: body.problemId,
                    workbookData: body.workbookData,
                    timeSpentSeconds: body.timeSpentSeconds,
                },
            );
            return reply
                .status(201)
                .send({ success: true, data: { submission, result } });
        },
    );

    app.get(
        "/:id",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const row = await submissionService.findById(app.db, id);
            if (!row) {
                return reply.status(404).send({
                    success: false,
                    error: "Not found",
                    code: "NOT_FOUND",
                });
            }
            if (row.userId !== request.userId && request.userRole !== "admin") {
                return reply.status(403).send({
                    success: false,
                    error: "Forbidden",
                    code: "FORBIDDEN",
                });
            }
            return { success: true, data: row };
        },
    );

    app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
        const query = PaginationQueryDto.parse(request.query);
        const rows = await submissionService.findByUser(
            app.db,
            request.userId,
            query.page,
            query.limit,
        );
        return { success: true, data: rows };
    });

    app.get(
        "/problem/:problemId/stats",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            if (request.userRole !== "admin") {
                return reply.status(403).send({
                    success: false,
                    error: "Forbidden",
                    code: "FORBIDDEN",
                });
            }
            const { problemId } = request.params as { problemId: string };
            const stats = await submissionService.getProblemStats(
                app.db,
                problemId,
            );
            return { success: true, data: stats };
        },
    );
};
