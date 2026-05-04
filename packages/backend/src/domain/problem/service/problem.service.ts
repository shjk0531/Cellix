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
            aoa[r][c] = cell.value;
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export const problemService = {
    async findAll(db: DB, query: GetProblemsQuery, isAdmin: boolean) {
        return problemRepository.findAll(db, query, isAdmin);
    },

    async findById(db: DB, id: string, userId?: string) {
        const row = await problemRepository.findById(db, id);
        if (!row) return null;

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

    async create(db: DB, data: ProblemBody, createdBy: string) {
        return problemRepository.create(db, { ...data, createdBy });
    },

    async update(db: DB, id: string, data: Partial<ProblemBody>) {
        const row = await problemRepository.update(db, id, data);
        if (!row) {
            throw Object.assign(new Error("Not found"), {
                statusCode: 404,
                code: "NOT_FOUND",
            });
        }
        return row;
    },

    async delete(db: DB, id: string) {
        return problemRepository.delete(db, id);
    },
};
