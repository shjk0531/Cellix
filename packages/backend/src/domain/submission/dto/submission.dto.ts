import { z } from "zod";

export const SubmitBodyDto = z.object({
    problemId: z.string().uuid(),
    workbookData: z.unknown(),
    timeSpentSeconds: z.number().int().min(0).optional(),
});

export const PaginationQueryDto = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SubmitBody = z.infer<typeof SubmitBodyDto>;
export type PaginationQuery = z.infer<typeof PaginationQueryDto>;
