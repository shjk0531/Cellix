import type { FastifyPluginAsync } from "fastify";
import { ProblemBodyDto, GetProblemsQueryDto } from "../dto/problem.dto.js";
import { problemService } from "../service/problem.service.js";

export const problemController: FastifyPluginAsync = async (app) => {
    app.get("/", async (request) => {
        const query = GetProblemsQueryDto.parse(request.query);

        let isAdmin = false;
        try {
            const payload = await request.jwtVerify<{
                sub: string;
                role: string;
            }>();
            if (payload.role === "admin") isAdmin = true;
        } catch {
            /* public access */
        }

        const { rows, total } = await problemService.findAll(
            app.db,
            query,
            isAdmin,
        );
        return { success: true, data: rows, total, page: query.page };
    });

    app.get("/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        let requestUserId: string | undefined;
        try {
            const payload = await request.jwtVerify<{
                sub: string;
                role: string;
            }>();
            requestUserId = payload.sub;
        } catch {
            /* public */
        }

        const result = await problemService.findById(app.db, id, requestUserId);
        if (!result) {
            return reply.status(404).send({
                success: false,
                error: "Not found",
                code: "NOT_FOUND",
            });
        }
        return { success: true, data: result };
    });

    app.get("/:id/template-download", async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await problemService.getTemplateXlsx(app.db, id);
        if (!result) {
            return reply.status(404).send({
                success: false,
                error: "Template not found",
                code: "NOT_FOUND",
            });
        }
        const filename = encodeURIComponent(`${result.title}.xlsx`);
        return reply
            .header(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            .header(
                "Content-Disposition",
                `attachment; filename*=UTF-8''${filename}`,
            )
            .send(result.buffer);
    });

    app.post(
        "/",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            if (request.userRole !== "admin") {
                return reply.status(403).send({
                    success: false,
                    error: "Forbidden",
                    code: "FORBIDDEN",
                });
            }
            const body = ProblemBodyDto.parse(request.body);
            const row = await problemService.create(
                app.db,
                body,
                request.userId,
            );
            return reply.status(201).send({ success: true, data: row });
        },
    );

    app.put(
        "/:id",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            if (request.userRole !== "admin") {
                return reply.status(403).send({
                    success: false,
                    error: "Forbidden",
                    code: "FORBIDDEN",
                });
            }
            const { id } = request.params as { id: string };
            const body = ProblemBodyDto.partial().parse(request.body);
            const row = await problemService.update(app.db, id, body);
            return { success: true, data: row };
        },
    );

    app.delete(
        "/:id",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            if (request.userRole !== "admin") {
                return reply.status(403).send({
                    success: false,
                    error: "Forbidden",
                    code: "FORBIDDEN",
                });
            }
            const { id } = request.params as { id: string };
            await problemService.delete(app.db, id);
            return { success: true, data: null };
        },
    );
};
