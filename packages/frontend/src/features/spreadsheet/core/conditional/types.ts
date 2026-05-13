import type { CellStyle, CellRange } from "@cellix/shared";

export type CondFmtRuleType =
    | "cellValue"
    | "formula"
    | "colorScale"
    | "dataBar"
    | "iconSet"
    | "topBottom"
    | "aboveBelow";

export type CondFmtOperator =
    | "between"
    | "notBetween"
    | "equal"
    | "notEqual"
    | "greaterThan"
    | "lessThan"
    | "greaterThanOrEqual"
    | "lessThanOrEqual"
    | "containsText"
    | "notContainsText"
    | "beginsWith"
    | "endsWith"
    | "isBlank"
    | "isNotBlank"
    | "isDuplicate"
    | "isUnique";

export interface CondFmtCellValueRule {
    type: "cellValue";
    operator: CondFmtOperator;
    value1?: string;
    value2?: string;
    format: Partial<CellStyle>;
}

export interface CondFmtFormulaRule {
    type: "formula";
    formula: string;
    format: Partial<CellStyle>;
}

export interface CondFmtColorScaleRule {
    type: "colorScale";
    minColor: string;
    midColor?: string;
    maxColor: string;
    minType: "min" | "number" | "percent" | "percentile";
    midType?: "number" | "percent" | "percentile";
    maxType: "max" | "number" | "percent" | "percentile";
    minValue?: number;
    midValue?: number;
    maxValue?: number;
}

export interface CondFmtDataBarRule {
    type: "dataBar";
    color: string;
    showValue: boolean;
    minValue?: number;
    maxValue?: number;
}

export interface CondFmtTopBottomRule {
    type: "topBottom";
    rank: number;
    bottom: boolean;
    percent: boolean;
    format: Partial<CellStyle>;
}

export type CondFmtRule =
    | CondFmtCellValueRule
    | CondFmtFormulaRule
    | CondFmtColorScaleRule
    | CondFmtDataBarRule
    | CondFmtTopBottomRule;

export interface CondFmtEntry {
    id: string;
    sheetId: string;
    range: CellRange;
    rule: CondFmtRule;
    priority: number;
    stopIfTrue: boolean;
}
