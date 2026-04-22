import type { CellRange, CellStyle } from "./cell";

// ── 표 (Ctrl+T) ───────────────────────────────────────────────────────────────

export type TableStyleName =
    | "TableStyleLight1"
    | "TableStyleLight2"
    | "TableStyleMedium1"
    | "TableStyleMedium2"
    | "TableStyleDark1"
    | "TableStyleDark2"
    | string;

export interface TableColumn {
    index: number;
    name: string;
    style?: CellStyle;
    totalRowLabel?: string;
    totalRowFunction?: "sum" | "count" | "average" | "min" | "max" | "none";
}

export interface TableDefinition {
    id: string;
    name: string;
    sheetId: string;
    range: CellRange;
    columns: TableColumn[];
    styleName?: TableStyleName;
    showHeaderRow: boolean;
    showTotalRow: boolean;
    showBandedRows: boolean;
    showBandedCols: boolean;
    showFirstColumnStripe: boolean;
    showLastColumnStripe: boolean;
}
