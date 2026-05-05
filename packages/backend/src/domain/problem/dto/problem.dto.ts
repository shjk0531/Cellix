import { z } from "zod";

const GradingCellSchema = z.object({
    sheetId: z.string(),
    address: z.string(),
    expectedValue: z.unknown().optional(),
    tolerance: z.number().optional(),
    checkFormula: z.boolean().optional(),
    formulaPattern: z.string().optional(),
    scoreWeight: z.number(),
});

export const GradingConfigDto = z.object({
    cells: z.array(GradingCellSchema).optional(),
    tables: z
        .array(
            z.object({
                name: z.string(),
                checkColumns: z.boolean().optional(),
                scoreWeight: z.number(),
            }),
        )
        .optional(),
    charts: z
        .array(
            z.object({
                type: z.string().optional(),
                scoreWeight: z.number(),
            }),
        )
        .optional(),
    totalScore: z.number(),
});

export const ProblemBodyDto = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    level: z.number().int().min(1).max(5).default(1),
    type: z.enum([
        "formula",
        "formatting",
        "chart",
        "table",
        "function",
        "data",
        "mixed",
    ]),
    // admin만 "official" 지정 가능. 일반 사용자는 서비스 레이어에서 "community"로 강제
    sourceType: z.enum(["official", "community"]).optional(),
    category: z.enum(["practice", "exam", "skill_check"]).default("practice"),
    stepLevel: z.number().int().min(1).optional(),
    status: z
        .enum(["draft", "pending_review", "published", "rejected"])
        .optional(),
    score: z.number().int().min(1).default(100),
    timeLimit: z.number().int().min(1).optional(),
    estimatedMinutes: z.number().int().min(1).optional(),
    templateWorkbook: z.unknown().optional(),
    answerWorkbook: z.unknown().optional(),
    gradingConfig: GradingConfigDto,
    hints: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
});

export const GetProblemsQueryDto = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    level: z.coerce.number().int().min(1).max(5).optional(),
    type: z
        .enum(["formula", "formatting", "chart", "table", "function", "data", "mixed"])
        .optional(),
    sourceType: z.enum(["official", "community"]).optional(),
    category: z.enum(["practice", "exam", "skill_check"]).optional(),
    status: z
        .enum(["draft", "pending_review", "published", "rejected"])
        .optional(),
    search: z.string().optional(),
    tags: z.string().optional(),
    myOnly: z.coerce.boolean().optional(),
    bookmarked: z.coerce.boolean().optional(),
    sortBy: z
        .enum(["newest", "vote", "view", "acceptance", "difficulty"])
        .default("newest"),
});

export type ProblemBody = z.infer<typeof ProblemBodyDto>;
export type GetProblemsQuery = z.infer<typeof GetProblemsQueryDto>;
export type GradingConfig = z.infer<typeof GradingConfigDto>;
