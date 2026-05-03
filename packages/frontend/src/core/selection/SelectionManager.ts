import type { CellAddress } from "@cellix/shared";
import { MAX_ROWS, MAX_COLS } from "../viewport/ViewportManager";
import type {
    SelectionRange,
    SelectionState,
    SelectionListener,
    FormulaRefInsertedListener,
} from "./types";
import { RANGE_COLORS } from "./types";

// 방향키 → [deltaRow, deltaCol]
const ARROW_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
};

function colToLetter(col: number): string {
    let result = "";
    let n = col + 1;
    while (n > 0) {
        const rem = (n - 1) % 26;
        result = String.fromCharCode(65 + rem) + result;
        n = Math.floor((n - 1) / 26);
    }
    return result;
}

function cellToRef(row: number, col: number): string {
    return `${colToLetter(col)}${row + 1}`;
}

function clampRow(row: number): number {
    return Math.max(0, Math.min(row, MAX_ROWS - 1));
}

function clampCol(col: number): number {
    return Math.max(0, Math.min(col, MAX_COLS - 1));
}

function mkAddr(row: number, col: number, sheetId: string): CellAddress {
    return { row, col, sheetId };
}

/**
 * 스프레드시트 셀 선택 상태를 관리.
 *
 * 지원 기능:
 *  - 단일 셀 선택, 드래그 범위 선택
 *  - Shift+클릭 범위 확장 / Ctrl+클릭 다중 범위 추가
 *  - Ctrl+A 전체 선택
 *  - 수식 입력 중 Ctrl+클릭 → 셀 참조 삽입 + 색깔 테두리
 *  - 방향키 이동 (Shift+방향키 범위 확장)
 *  - Enter(아래) / Tab(오른쪽) 이동
 *
 * activeCell은 선택 앵커(고정 끝)를 가리키며, Shift 계열 조작에서는 변경되지 않음.
 */
export class SelectionManager {
    private sheetId: string;
    private selections: SelectionRange[] = [];

    /** 선택 앵커. Shift 조작 시 고정됨. */
    private activeCell: { row: number; col: number } | null = null;

    /** 드래그/Shift 확장 시 시작점으로 사용하는 앵커. */
    private dragAnchor: { row: number; col: number } | null = null;

    private isDragging = false;
    private isEditingFormula = false;

    /** 수식 참조 색상 순환 인덱스 */
    private formulaRefIndex = 0;

    private readonly selectionListeners = new Set<SelectionListener>();
    private readonly formulaRefListeners =
        new Set<FormulaRefInsertedListener>();

    constructor(sheetId: string) {
        this.sheetId = sheetId;
    }

    // ── 구독 ──────────────────────────────────────────────────────────────────

    /** 선택 상태 변경 구독. 구독 해제 함수 반환. */
    subscribe(listener: SelectionListener): () => void {
        this.selectionListeners.add(listener);
        listener(this._buildState());
        return () => this.selectionListeners.delete(listener);
    }

    /** 수식 참조 삽입 이벤트 구독. */
    onFormulaRefInserted(listener: FormulaRefInsertedListener): () => void {
        this.formulaRefListeners.add(listener);
        return () => this.formulaRefListeners.delete(listener);
    }

    // ── 마우스 이벤트 ─────────────────────────────────────────────────────────

    handleMouseDown(
        row: number,
        col: number,
        modifiers: { shift: boolean; ctrl: boolean },
    ): void {
        row = clampRow(row);
        col = clampCol(col);

        // 수식 입력 중 Ctrl+클릭: 셀 참조 삽입 (드래그 시작 없음)
        if (this.isEditingFormula && modifiers.ctrl) {
            const color =
                RANGE_COLORS[this.formulaRefIndex % RANGE_COLORS.length];
            this.formulaRefIndex++;
            const a = mkAddr(row, col, this.sheetId);
            this.selections = [...this.selections, { start: a, end: a, color }];
            this._emitFormulaRef(cellToRef(row, col), color);
            this._notify();
            return;
        }

        if (modifiers.shift && this.activeCell !== null) {
            // Shift+클릭: activeCell(앵커)로부터 클릭 셀까지 마지막 범위 확장
            const ac = this.activeCell;
            const lastColor = this.selections.at(-1)?.color ?? RANGE_COLORS[0];
            const extended: SelectionRange = {
                start: mkAddr(ac.row, ac.col, this.sheetId),
                end: mkAddr(row, col, this.sheetId),
                color: lastColor,
            };
            this.selections =
                this.selections.length > 0
                    ? [...this.selections.slice(0, -1), extended]
                    : [extended];
            // activeCell은 앵커이므로 변경하지 않음
            this.dragAnchor = { row: ac.row, col: ac.col };
        } else if (modifiers.ctrl) {
            // Ctrl+클릭: 새 범위 추가 (다른 색상)
            const color =
                RANGE_COLORS[this.selections.length % RANGE_COLORS.length];
            const a = mkAddr(row, col, this.sheetId);
            this.selections = [...this.selections, { start: a, end: a, color }];
            this.activeCell = { row, col };
            this.dragAnchor = { row, col };
        } else {
            // 일반 클릭: 기존 선택 전체 교체
            const a = mkAddr(row, col, this.sheetId);
            this.selections = [{ start: a, end: a, color: RANGE_COLORS[0] }];
            this.activeCell = { row, col };
            this.dragAnchor = { row, col };
        }

        this.isDragging = true;
        this._notify();
    }

    handleMouseMove(row: number, col: number): void {
        if (
            !this.isDragging ||
            !this.dragAnchor ||
            this.selections.length === 0
        )
            return;

        row = clampRow(row);
        col = clampCol(col);

        const last = this.selections[this.selections.length - 1];
        this.selections = [
            ...this.selections.slice(0, -1),
            {
                start: mkAddr(
                    this.dragAnchor.row,
                    this.dragAnchor.col,
                    this.sheetId,
                ),
                end: mkAddr(row, col, this.sheetId),
                color: last.color,
            },
        ];
        this._notify();
    }

    handleMouseUp(): void {
        if (!this.isDragging) return;
        this.isDragging = false;
        this._notify();
    }

    // ── 키보드 이벤트 ─────────────────────────────────────────────────────────

    /**
     * 키 이벤트 처리. 이벤트를 소비한 경우 true 반환.
     * 수식 모드에서는 Enter를 소비하지 않아 수식 에디터가 처리 가능.
     */
    handleKeyDown(
        key: string,
        modifiers: { shift: boolean; ctrl: boolean },
    ): boolean {
        // Ctrl+A: 전체 선택
        if (modifiers.ctrl && key.toLowerCase() === "a") {
            this._selectAll();
            return true;
        }

        // 방향키 이동 / 확장
        const delta = ARROW_DELTAS[key];
        if (delta !== undefined) {
            this._moveActive(delta[0], delta[1], modifiers.shift);
            return true;
        }

        // Enter: 위/아래 이동 (수식 모드에서는 처리하지 않음)
        if (key === "Enter" && !this.isEditingFormula) {
            this._moveActive(modifiers.shift ? -1 : 1, 0, false);
            return true;
        }

        // Tab: 왼쪽/오른쪽 이동
        if (key === "Tab") {
            this._moveActive(0, modifiers.shift ? -1 : 1, false);
            return true;
        }

        return false;
    }

    // ── 수식 모드 ─────────────────────────────────────────────────────────────

    /**
     * 수식 입력 모드 전환.
     * 비활성화 시 참조 색상 인덱스를 초기화.
     */
    setFormulaMode(enabled: boolean): void {
        this.isEditingFormula = enabled;
        if (!enabled) this.formulaRefIndex = 0;
    }

    // ── 시트 전환 ─────────────────────────────────────────────────────────────

    setSheetId(sheetId: string): void {
        this.sheetId = sheetId;
        this.selections = [];
        this.activeCell = null;
        this.dragAnchor = null;
        this._notify();
    }

    // ── 상태 접근자 ───────────────────────────────────────────────────────────

    getSelections(): SelectionRange[] {
        return this.selections;
    }

    getActiveCell(): { row: number; col: number } | null {
        return this.activeCell;
    }

    getState(): SelectionState {
        return this._buildState();
    }

    destroy(): void {
        this.selectionListeners.clear();
        this.formulaRefListeners.clear();
    }

    // ── 내부 ─────────────────────────────────────────────────────────────────

    private _selectAll(): void {
        this.selections = [
            {
                start: mkAddr(0, 0, this.sheetId),
                end: mkAddr(MAX_ROWS - 1, MAX_COLS - 1, this.sheetId),
                color: RANGE_COLORS[0],
            },
        ];
        this.activeCell = { row: 0, col: 0 };
        this.dragAnchor = { row: 0, col: 0 };
        this._notify();
    }

    private _moveActive(dr: number, dc: number, extend: boolean): void {
        if (extend && this.selections.length > 0 && this.activeCell !== null) {
            // Shift+방향키: activeCell(앵커)은 고정, 마지막 범위의 end를 이동
            const last = this.selections[this.selections.length - 1];
            const prevEnd = last.end;
            const nextRow = clampRow(prevEnd.row + dr);
            const nextCol = clampCol(prevEnd.col + dc);
            this.selections = [
                ...this.selections.slice(0, -1),
                {
                    start: mkAddr(
                        this.activeCell.row,
                        this.activeCell.col,
                        this.sheetId,
                    ),
                    end: mkAddr(nextRow, nextCol, this.sheetId),
                    color: last.color ?? RANGE_COLORS[0],
                },
            ];
            // activeCell은 앵커이므로 변경하지 않음
        } else {
            // 일반 방향키: activeCell 이동 + 선택 범위 단일 셀로 축소
            const cur = this.activeCell ?? { row: 0, col: 0 };
            const nextRow = clampRow(cur.row + dr);
            const nextCol = clampCol(cur.col + dc);
            const a = mkAddr(nextRow, nextCol, this.sheetId);
            this.selections = [{ start: a, end: a, color: RANGE_COLORS[0] }];
            this.activeCell = { row: nextRow, col: nextCol };
            this.dragAnchor = { row: nextRow, col: nextCol };
        }
        this._notify();
    }

    private _buildState(): SelectionState {
        return {
            selections: [...this.selections],
            activeCell: this.activeCell ? { ...this.activeCell } : null,
            isDragging: this.isDragging,
            isEditingFormula: this.isEditingFormula,
        };
    }

    private _notify(): void {
        const state = this._buildState();
        for (const fn of this.selectionListeners) fn(state);
    }

    private _emitFormulaRef(ref: string, color: string): void {
        for (const fn of this.formulaRefListeners) fn(ref, color);
    }
}
