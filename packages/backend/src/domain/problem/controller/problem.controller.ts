import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { ProblemBodyDto, GetProblemsQueryDto } from "../dto/problem.dto.js";
import { problemService } from "../service/problem.service.js";

export const problemController: FastifyPluginAsync = async (app) => {
    // 문제 목록 조회 (공개 접근 가능, 로그인 시 추가 필터)
    app.get("/", async (request) => {
        const query = GetProblemsQueryDto.parse(request.query);

        let isAdmin = false;
        let userId: string | undefined;
        try {
            const payload = await request.jwtVerify<{
                sub: string;
                role: string;
            }>();
            isAdmin = payload.role === "admin";
            userId = payload.sub;
        } catch {
            /* public access */
        }

        const { rows, total } = await problemService.findAll(app.db, query, {
            isAdmin,
            userId,
        });
        return { success: true, data: rows, total, page: query.page };
    });

    // 문제 상세 조회
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
            return reply
                .status(404)
                .send({ success: false, error: "Not found", code: "NOT_FOUND" });
        }
        return { success: true, data: result };
    });

    // 템플릿 xlsx 다운로드
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

    // 문제 생성 (admin: official/published, 일반: community/draft)
    app.post(
        "/",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const body = ProblemBodyDto.parse(request.body);
            const row = await problemService.create(
                app.db,
                body,
                request.userId,
                request.userRole,
            );
            return reply.status(201).send({ success: true, data: row });
        },
    );

    // 문제 수정 (본인 또는 admin)
    app.put(
        "/:id",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const body = ProblemBodyDto.partial().parse(request.body);
            const row = await problemService.update(
                app.db,
                id,
                body,
                request.userId,
                request.userRole,
            );
            return { success: true, data: row };
        },
    );

    // 문제 삭제 (본인 또는 admin)
    app.delete(
        "/:id",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            await problemService.delete(
                app.db,
                id,
                request.userId,
                request.userRole,
            );
            return { success: true, data: null };
        },
    );

    // 일반 사용자 → 검토 요청 (draft → pending_review)
    app.post(
        "/:id/submit-review",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const row = await problemService.submitForReview(
                app.db,
                id,
                request.userId,
            );
            return { success: true, data: row };
        },
    );

    // admin → 검토 결과 처리 (pending_review → published | rejected)
    app.patch(
        "/:id/review",
        { preHandler: [app.authenticate] },
        async (request, reply) => {
            if (request.userRole !== "admin") {
                return reply
                    .status(403)
                    .send({ success: false, error: "Forbidden", code: "FORBIDDEN" });
            }
            const { id } = request.params as { id: string };
            const { verdict, reviewNote } = z
                .object({
                    verdict: z.enum(["published", "rejected"]),
                    reviewNote: z.string().optional(),
                })
                .parse(request.body);

            const row = await problemService.reviewProblem(
                app.db,
                id,
                verdict,
                reviewNote,
            );
            return { success: true, data: row };
        },
    );
};
