import type { CellData, CellStyle } from "./cell";

// ── 시트 ─────────────────────────────────────────────────────────────────────

export type CellKey = string; // "{row}:{col}" 형식

export interface ColumnMeta {
    width?: number;
    hidden?: boolean;
    style?: CellStyle;
}

export interface RowMeta {
    height?: number;
    hidden?: boolean;
    style?: CellStyle;
}

export interface SheetData {
    id: string;
    name: string;
    cells: Map<CellKey, CellData>;
    columnMeta: Map<number, ColumnMeta>;
    rowMeta: Map<number, RowMeta>;
    frozenRows?: number;
    frozenCols?: number;
    hidden?: boolean;
}

// ── 워크북 ────────────────────────────────────────────────────────────────────

export interface WorkbookData {
    id: string;
    name: string;
    sheets: Map<string, SheetData>;
    sheetOrder: string[];
    activeSheetId: string;
    createdAt: string;
    updatedAt: string;
}
