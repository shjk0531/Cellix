import { z } from "zod";

export const UpdateMeBodyDto = z.object({
    name: z.string().min(1).max(100).optional(),
});

export const PaginationQueryDto = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type UpdateMeBody = z.infer<typeof UpdateMeBodyDto>;
export type PaginationQuery = z.infer<typeof PaginationQueryDto>;
