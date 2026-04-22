export type CellValue = string | number | boolean | null;

export interface CellAddress {
    row: number;
    col: number;
    sheetId: string;
}

export interface CellRange {
    start: CellAddress;
    end: CellAddress;
}

// ── 스타일 ───────────────────────────────────────────────────────────────────

export type FontWeight = "normal" | "bold";
export type FontStyle = "normal" | "italic";
export type TextDecoration = "none" | "underline" | "line-through";
export type HorizontalAlign =
    | "left"
    | "center"
    | "right"
    | "justify"
    | "general";
export type VerticalAlign = "top" | "middle" | "bottom";
export type BorderStyle =
    | "none"
    | "thin"
    | "medium"
    | "thick"
    | "dashed"
    | "dotted"
    | "double"
    | "hair"
    | "mediumDashed"
    | "dashDot"
    | "mediumDashDot"
    | "slantDashDot";

export interface BorderSide {
    style: BorderStyle;
    color: string;
}

export interface CellBorder {
    top?: BorderSide;
    right?: BorderSide;
    bottom?: BorderSide;
    left?: BorderSide;
}

export interface CellFont {
    family?: string;
    size?: number;
    weight?: FontWeight;
    style?: FontStyle;
    decoration?: TextDecoration;
    color?: string;
}

export interface CellStyle {
    font?: CellFont;
    backgroundColor?: string;
    border?: CellBorder;
    horizontalAlign?: HorizontalAlign;
    verticalAlign?: VerticalAlign;
    wrapText?: boolean;
    numberFormat?: string;
    indent?: number;
    locked?: boolean;
}

// ── 병합 ─────────────────────────────────────────────────────────────────────

export interface MergeInfo {
    rowSpan: number;
    colSpan: number;
    isMerged: boolean;
    masterCell?: CellAddress;
}

// ── 셀 ───────────────────────────────────────────────────────────────────────

export interface CellData {
    value: CellValue;
    formula?: string;
    style?: CellStyle;
    mergeInfo?: MergeInfo;
}
