import type { WorkbookData } from "./sheet";

// ── Exam Problem ──────────────────────────────────────────────────────────────

export type ProblemType =
    | "formula"
    | "formatting"
    | "chart"
    | "table"
    | "pivot"
    | "function"
    | "mixed";

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface GradingRule {
    targetCell?: string;
    targetRange?: string;
    expectedValue?: string | number | boolean;
    expectedFormula?: string;
    checkStyle?: boolean;
    scoreWeight: number;
    partialCredit: boolean;
}

export interface ExamProblem {
    id: string;
    title: string;
    description: string;
    type: ProblemType;
    difficulty: DifficultyLevel;
    score: number;
    timeLimit?: number;
    initialWorkbook?: WorkbookData;
    gradingRules: GradingRule[];
    hints?: string[];
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

// ── Submission & Result ───────────────────────────────────────────────────────

export type GradingStatus = "pass" | "partial" | "fail";

export interface RuleResult {
    ruleIndex: number;
    status: GradingStatus;
    earnedScore: number;
    maxScore: number;
    feedback?: string;
}

export interface SubmissionResult {
    submissionId: string;
    problemId: string;
    userId: string;
    submittedAt: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    status: GradingStatus;
    ruleResults: RuleResult[];
    gradedWorkbook?: WorkbookData;
    timeSpentSeconds?: number;
}
