import type { CellValue } from "@cellix/shared";
import type {
    DifficultyLevel,
    ProblemType,
    ProblemSourceType,
    ProblemCategory,
    ProblemStatus,
} from "@cellix/shared";

export interface ProblemSummary {
    id: string;
    title: string;
    description: string;
    type: ProblemType;
    difficulty: DifficultyLevel;
    level: number;
    score: number;
    timeLimit: number | null;
    estimatedMinutes: number | null;
    hints: string[] | null;
    tags: string[] | null;
    sourceType: ProblemSourceType;
    category: ProblemCategory;
    stepLevel: number | null;
    status: ProblemStatus;
    voteUp: number;
    voteDown: number;
    viewCount: number;
    acceptanceRate: string | null;
    solveCount: number;
    reviewNote: string | null;
    isPublished: boolean;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
    templateWorkbook: unknown;
    // 진행 상태 (로그인 사용자)
    progress?: { progressStatus: string; bestScore: string | null } | null;
}

export interface CellRuleResult {
    address: string;
    sheetId: string;
    passed: boolean;
    earnedScore: number;
    maxScore: number;
    actualValue?: CellValue;
    expectedValue?: CellValue;
    formulaUsed?: string;
    formulaMatched?: boolean;
    hint?: string;
}

export interface TableRuleResult {
    name: string;
    passed: boolean;
    earnedScore: number;
    maxScore: number;
    hint?: string;
}

export interface GradingResult {
    totalScore: number;
    maxScore: number;
    percentage: number;
    status: "pass" | "partial" | "fail";
    cellResults: CellRuleResult[];
    tableResults: TableRuleResult[];
    feedback: string;
}

export interface SubmissionResponse {
    submission: {
        id: string;
        userId: string;
        problemId: string;
        totalScore: string;
        maxScore: number;
        percentage: string;
        status: string;
        submittedAt: string;
    };
    result: GradingResult;
}
