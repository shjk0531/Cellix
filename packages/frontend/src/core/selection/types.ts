import type { CellAddress } from "@cellix/shared";

export interface SelectionRange {
    start: CellAddress;
    end: CellAddress;
    color?: string;
}

export interface SelectionState {
    selections: SelectionRange[];
    activeCell: { row: number; col: number } | null;
    isDragging: boolean;
    isEditingFormula: boolean;
}

export type SelectionListener = (state: SelectionState) => void;

/** 수식 모드에서 셀 참조가 삽입될 때 호출 */
export type FormulaRefInsertedListener = (ref: string, color: string) => void;

/** 다중 선택 및 수식 참조용 색상 팔레트 (파랑→초록→주황→보라→빨강 순환) */
export const RANGE_COLORS = [
    "#4B87FF", // 파랑 (기본 선택색)
    "#00CC66", // 초록
    "#FF8C00", // 주황
    "#9B59B6", // 보라
    "#E74C3C", // 빨강
] as const;

export type RangeColor = (typeof RANGE_COLORS)[number];
