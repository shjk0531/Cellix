import type { submissions } from "../../../global/db/schema.js";
import type { CellValue } from "@cellix/shared";

export type Submission = typeof submissions.$inferSelect;

export interface CellGradingRule {
    sheetId: string;
    address: string;
    expectedValue?: CellValue;
    tolerance?: number;
    checkFormula?: boolean;
    formulaPattern?: string;
    scoreWeight: number;
    hint?: string;
}

export interface TableGradingRule {
    name: string;
    checkColumns?: boolean;
    expectedColumns?: string[];
    scoreWeight: number;
    hint?: string;
}

export interface ChartGradingRule {
    expectedType?: string;
    scoreWeight: number;
    hint?: string;
}

export interface GradingConfig {
    cells?: CellGradingRule[];
    tables?: TableGradingRule[];
    charts?: ChartGradingRule[];
    totalScore: number;
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

export interface GradingResult {
    totalScore: number;
    maxScore: number;
    percentage: number;
    status: "pass" | "partial" | "fail";
    cellResults: CellRuleResult[];
    tableResults: {
        name: string;
        passed: boolean;
        earnedScore: number;
        maxScore: number;
        hint?: string;
    }[];
    feedback: string;
}
