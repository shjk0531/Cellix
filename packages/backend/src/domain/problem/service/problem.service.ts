import {
    ForbiddenException,
    Injectable,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common";
import * as XLSX from "xlsx";
import type { SerializedWorkbookData } from "@cellix/shared";
import { ProblemRepository } from "../repository/problem.repository.js";
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

@Injectable()
export class ProblemService {
    constructor(private readonly problemRepository: ProblemRepository) {}

    async findAll(
        query: GetProblemsQuery,
        options: { isAdmin: boolean; userId?: string },
    ) {
        return this.problemRepository.findAll(query, options);
    }

    async findById(id: string, userId?: string) {
        const row = await this.problemRepository.findById(id);
        if (!row) return null;

        await this.problemRepository.incrementViewCount(id);

        let progress = null;
        if (userId) {
            progress = await this.problemRepository.findProgress(userId, id);
        }

        return { ...row, progress };
    }

    async getTemplateXlsx(id: string) {
        const row = await this.problemRepository.findByIdWithPrivate(id);
        if (!row || !row.templateWorkbook) return null;
        const data = row.templateWorkbook as unknown as SerializedWorkbookData;
        return { title: row.title, buffer: buildXlsxBuffer(data) };
    }

    async create(
        data: ProblemBody,
        createdBy: string,
        role: string,
    ) {
        const isAdmin = role === "admin";
        return this.problemRepository.create({
            ...data,
            // ?ºÎ∞ò ?¨Ïö©?êÍ? ÎßåÎì† Î¨∏Ï†ú??"community" Í∞ïÏ†ú, draft ?ÅÌÉúÎ°??úÏûë
            sourceType: isAdmin ? (data.sourceType ?? "official") : "community",
            status: isAdmin ? (data.status ?? "published") : "draft",
            isPublished: isAdmin,
            createdBy,
        });
    }

    async update(
        id: string,
        data: Partial<ProblemBody>,
        requestUserId: string,
        role: string,
    ) {
        const existing = await this.problemRepository.findByIdWithPrivate(id);
        if (!existing) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }

        // Î≥∏Ïù∏ Î¨∏Ï†ú ?êÎäî adminÎß??òÏ†ï Í∞Ä??
        if (role !== "admin" && existing.createdBy !== requestUserId) {
            throw new ForbiddenException({ error: "Forbidden", code: "FORBIDDEN" });
        }

        const row = await this.problemRepository.update(id, data);
        if (!row) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }
        return row;
    }

    async delete(
        id: string,
        requestUserId: string,
        role: string,
    ) {
        const existing = await this.problemRepository.findByIdWithPrivate(id);
        if (!existing) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }
        if (role !== "admin" && existing.createdBy !== requestUserId) {
            throw new ForbiddenException({ error: "Forbidden", code: "FORBIDDEN" });
        }
        return this.problemRepository.delete(id);
    }

    // ?ºÎ∞ò ?¨Ïö©?êÍ? Î¨∏Ï†ú Í≤Ä???îÏ≤≠ (draft ??pending_review)
    async submitForReview(id: string, requestUserId: string) {
        const existing = await this.problemRepository.findByIdWithPrivate(id);
        if (!existing) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }
        if (existing.createdBy !== requestUserId) {
            throw new ForbiddenException({ error: "Forbidden", code: "FORBIDDEN" });
        }
        if (existing.status !== "draft") {
            throw new BadRequestException({
                error: "Only draft problems can be submitted for review",
                code: "INVALID_STATUS",
            });
        }
        return this.problemRepository.update(id, {
            status: "pending_review",
        } as Partial<ProblemBody>);
    }

    // admin Í≤Ä??Ï≤òÎ¶¨ (pending_review ??published | rejected)
    async reviewProblem(
        id: string,
        verdict: "published" | "rejected",
        reviewNote?: string,
    ) {
        const existing = await this.problemRepository.findByIdWithPrivate(id);
        if (!existing) {
            throw new NotFoundException({ error: "Not found", code: "NOT_FOUND" });
        }
        return this.problemRepository.update(id, {
            status: verdict,
            reviewNote: reviewNote ?? null,
            isPublished: verdict === "published",
        } as Partial<ProblemBody>);
    }
}
