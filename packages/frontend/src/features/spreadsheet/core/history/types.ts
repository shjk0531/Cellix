import type { CellData } from "@cellix/shared";
import type { SelectionRange } from "../selection";

// ── Command 패턴 ──────────────────────────────────────────────────────────────

export interface Command {
    execute(): void;
    undo(): void;
    description?: string;
}

// ── History 상태 ──────────────────────────────────────────────────────────────

export interface HistoryState {
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
}

export type HistoryListener = (state: HistoryState) => void;

// ── 셀 데이터 접근자 (데이터 스토어 연동용 콜백) ────────────────────────────────

export type GetCellFn = (row: number, col: number) => CellData | null;
export type SetCellFn = (
    row: number,
    col: number,
    data: CellData | null,
) => void;

// ── 클립보드 ──────────────────────────────────────────────────────────────────

export type PasteMode = "all" | "values" | "formats" | "formulas";

export interface ClipboardBuffer {
    cells: (CellData | null)[][];
    rowCount: number;
    colCount: number;
    isCut: boolean;
    sourceRange: SelectionRange | null;
}

export interface PasteSpecialState {
    isOpen: boolean;
    mode: PasteMode;
}

export type CutSourceListener = (source: SelectionRange | null) => void;
export type PasteSpecialListener = (state: PasteSpecialState) => void;
