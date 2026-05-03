import type { CellValue } from "@cellix/shared";
import type { DifficultyLevel, ProblemType } from "@cellix/shared";

export interface ProblemSummary {
    id: string;
    title: string;
    description: string;
    type: ProblemType;
    difficulty: DifficultyLevel;
    score: number;
    timeLimit: number | null;
    hints: string[];
    tags: string[];
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    templateWorkbook: unknown;
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
