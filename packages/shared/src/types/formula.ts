// ── Formula Token ─────────────────────────────────────────────────────────────

export type FormulaTokenType =
  | "number"
  | "string"
  | "boolean"
  | "cellRef"
  | "rangeRef"
  | "namedRange"
  | "function"
  | "operator"
  | "comma"
  | "leftParen"
  | "rightParen"
  | "error"
  | "whitespace";

export type FormulaOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "&"
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">=";

export interface FormulaToken {
  type: FormulaTokenType;
  value: string;
  start: number;
  end: number;
  operator?: FormulaOperator;
}

export interface ParsedFormula {
  raw: string;
  tokens: FormulaToken[];
  dependencies: string[];
  isValid: boolean;
  error?: string;
}
