import * as XLSX from "xlsx";
import type { SerializedWorkbookData } from "@cellix/shared";
import type { DB } from "../../../global/db/index.js";
import { problemRepository } from "../repository/problem.repository.js";
import type { GetProblemsQuery, ProblemBody } from "../dto/problem.dto.js";

function buildXlsxBuffer(data: SerializedWorkbookData): Buffer {
    const wb = XLSX.utils.book_new();
    for (const sheetId of data.sheetOrder) {
        const sheet = data.sheets[sheetId];
        if (!sheet) continue;

        let maxRow = 0;
        let maxCol = 0;
        for (const key of Object.keys(sheet.cells)) {
            const [r, c] = key.split(":").map(Number);
            if (r > maxRow) maxRow = r;
            if (c > maxCol) maxCol = c;
        }

        const aoa: (string | number | boolean | null)[][] = Array.from(
            { length: maxRow + 1 },
            () =>
                Array(maxCol + 1).fill(null) as (
                    | string
                    | number
                    | boolean
                    | null
                )[],
        );
        for (const [key, cell] of Object.entries(sheet.cells)) {
            const [r, c] = key.split(":").map(Number);
            aoa[r][c] = (cell as { value: string | number | boolean | null }).value;
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export const problemService = {
    async findAll(
        db: DB,
        query: GetProblemsQuery,
        options: { isAdmin: boolean; userId?: string },
    ) {
        return problemRepository.findAll(db, query, options);
    },

    async findById(db: DB, id: string, userId?: string) {
        const row = await problemRepository.findById(db, id);
        if (!row) return null;

        await problemRepository.incrementViewCount(db, id);

        let progress = null;
        if (userId) {
            progress = await problemRepository.findProgress(db, userId, id);
        }

        return { ...row, progress };
    },

    async getTemplateXlsx(db: DB, id: string) {
        const row = await problemRepository.findByIdWithPrivate(db, id);
        if (!row || !row.templateWorkbook) return null;
        const data = row.templateWorkbook as unknown as SerializedWorkbookData;
        return { title: row.title, buffer: buildXlsxBuffer(data) };
    },

    async create(
        db: DB,
        data: ProblemBody,
        createdBy: string,
        role: string,
    ) {
        const isAdmin = role === "admin";
        return problemRepository.create(db, {
            ...data,
            // 일반 사용자가 만든 문제는 "community" 강제, draft 상태로 시작
            sourceType: isAdmin ? (data.sourceType ?? "official") : "community",
            status: isAdmin ? (data.status ?? "published") : "draft",
            isPublished: isAdmin,
            createdBy,
        });
    },

    async update(
        db: DB,
        id: string,
        data: Partial<ProblemBody>,
        requestUserId: string,
        role: string,
    ) {
        const existing = await problemRepository.findByIdWithPrivate(db, id);
        if (!existing) {
            throw Object.assign(new Error("Not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }

        // 본인 문제 또는 admin만 수정 가능
        if (role !== "admin" && existing.createdBy !== requestUserId) {
            throw Object.assign(new Error("Forbidden"), {
                statusCode: 403,
                code: "FORBIDDEN",
            });
        }

        const row = await problemRepository.update(db, id, data);
        if (!row) {
            throw Object.assign(new Error("Not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }
        return row;
    },

    async delete(
        db: DB,
        id: string,
        requestUserId: string,
        role: string,
    ) {
        const existing = await problemRepository.findByIdWithPrivate(db, id);
        if (!existing) {
            throw Object.assign(new Error("Not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }
        if (role !== "admin" && existing.createdBy !== requestUserId) {
            throw Object.assign(new Error("Forbidden"), {
                statusCode: 403,
                code: "FORBIDDEN",
            });
        }
        return problemRepository.delete(db, id);
    },

    // 일반 사용자가 문제 검토 요청 (draft → pending_review)
    async submitForReview(db: DB, id: string, requestUserId: string) {
        const existing = await problemRepository.findByIdWithPrivate(db, id);
        if (!existing) {
            throw Object.assign(new Error("Not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }
        if (existing.createdBy !== requestUserId) {
            throw Object.assign(new Error("Forbidden"), {
                statusCode: 403,
                code: "FORBIDDEN",
            });
        }
        if (existing.status !== "draft") {
            throw Object.assign(
                new Error("Only draft problems can be submitted for review"),
                { statusCode: 400, code: "INVALID_STATUS" },
            );
        }
        return problemRepository.update(db, id, {
            status: "pending_review",
        } as Partial<ProblemBody>);
    },

    // admin 검토 처리 (pending_review → published | rejected)
    async reviewProblem(
        db: DB,
        id: string,
        verdict: "published" | "rejected",
        reviewNote?: string,
    ) {
        const existing = await problemRepository.findByIdWithPrivate(db, id);
        if (!existing) {
            throw Object.assign(new Error("Not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }
        return problemRepository.update(db, id, {
            status: verdict,
            reviewNote: reviewNote ?? null,
            isPublished: verdict === "published",
        } as Partial<ProblemBody>);
    },
};
