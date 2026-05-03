import type { CellData } from "@cellix/shared";
import type { SelectionManager } from "../selection";
import type { SelectionRange } from "../selection";
import type { HistoryManager } from "./HistoryManager";
import type {
    Command,
    GetCellFn,
    SetCellFn,
    PasteMode,
    ClipboardBuffer,
    PasteSpecialState,
    CutSourceListener,
    PasteSpecialListener,
} from "./types";

/**
 * 복사/잘라내기/붙여넣기 관리.
 *
 * 지원 기능:
 *  - Ctrl+C: 선택 범위를 내부 버퍼 + 시스템 클립보드(TSV)에 복사
 *  - Ctrl+X: 복사 + 잘라내기 소스 마킹 (점선 테두리 표시용)
 *  - Ctrl+V: 활성 셀 위치에 붙여넣기. 내부 버퍼 우선, 없으면 시스템 클립보드 TSV 파싱
 *  - Ctrl+Shift+V: 선택하여 붙여넣기 다이얼로그 (onPasteSpecial 이벤트로 UI에 위임)
 *  - 엑셀에서 복사한 TSV 붙여넣기 지원
 *
 * 붙여넣기 모드:
 *  - 'all':      값 + 수식 + 서식 모두
 *  - 'values':   계산값만 (수식·서식 제외)
 *  - 'formulas': 수식(값) 만, 서식 제외
 *  - 'formats':  서식만, 대상 셀 값 유지
 *
 * 잘라내기 소스 렌더링:
 *   getCutSource() / onCutSourceChange()로 범위를 읽어 점선 테두리를 그림.
 */
export class ClipboardManager {
    private readonly _selection: SelectionManager;
    private readonly _history: HistoryManager;
    private readonly _getCell: GetCellFn;
    private readonly _setCell: SetCellFn;

    private _buffer: ClipboardBuffer | null = null;
    private _cutSource: SelectionRange | null = null;

    private readonly _cutSourceListeners = new Set<CutSourceListener>();
    private readonly _pasteSpecialListeners = new Set<PasteSpecialListener>();

    constructor(
        selection: SelectionManager,
        history: HistoryManager,
        getCell: GetCellFn,
        setCell: SetCellFn,
    ) {
        this._selection = selection;
        this._history = history;
        this._getCell = getCell;
        this._setCell = setCell;
    }

    // ── 구독 ──────────────────────────────────────────────────────────────────

    /** 잘라내기 소스 범위 변경 구독 (점선 테두리 렌더링용). */
    onCutSourceChange(listener: CutSourceListener): () => void {
        this._cutSourceListeners.add(listener);
        listener(this._cutSource);
        return () => this._cutSourceListeners.delete(listener);
    }

    /** 선택하여 붙여넣기 다이얼로그 상태 구독 (UI 다이얼로그 표시용). */
    onPasteSpecial(listener: PasteSpecialListener): () => void {
        this._pasteSpecialListeners.add(listener);
        return () => this._pasteSpecialListeners.delete(listener);
    }

    // ── 공개 API ──────────────────────────────────────────────────────────────

    getCutSource(): SelectionRange | null {
        return this._cutSource;
    }

    /**
     * 선택하여 붙여넣기 다이얼로그에서 모드 확정 시 호출.
     * 내부적으로 해당 모드로 붙여넣기를 실행하고 다이얼로그를 닫음.
     */
    confirmPasteSpecial(mode: PasteMode): void {
        this._executePaste(mode);
        this._notifyPasteSpecial({ isOpen: false, mode });
    }

    // ── 키보드 이벤트 ─────────────────────────────────────────────────────────

    /**
     * 키 이벤트 처리. 이벤트를 소비한 경우 true 반환.
     *   Ctrl+C          → 복사
     *   Ctrl+X          → 잘라내기
     *   Ctrl+V          → 붙여넣기
     *   Ctrl+Shift+V    → 선택하여 붙여넣기 다이얼로그
     */
    handleKeyDown(
        key: string,
        modifiers: { shift: boolean; ctrl: boolean },
    ): boolean {
        if (!modifiers.ctrl) return false;

        const k = key.toLowerCase();

        if (!modifiers.shift && k === "c") {
            this._copy();
            return true;
        }

        if (!modifiers.shift && k === "x") {
            this._cut();
            return true;
        }

        if (!modifiers.shift && k === "v") {
            this._pasteFromBuffer();
            return true;
        }

        if (modifiers.shift && k === "v") {
            this._openPasteSpecial();
            return true;
        }

        return false;
    }

    destroy(): void {
        this._cutSourceListeners.clear();
        this._pasteSpecialListeners.clear();
        this._buffer = null;
        this._cutSource = null;
    }

    // ── 복사 / 잘라내기 ───────────────────────────────────────────────────────

    private _copy(): void {
        const selections = this._selection.getSelections();
        if (selections.length === 0) return;
        this._captureBuffer(selections[selections.length - 1], false);
    }

    private _cut(): void {
        const selections = this._selection.getSelections();
        if (selections.length === 0) return;
        this._captureBuffer(selections[selections.length - 1], true);
    }

    private _captureBuffer(range: SelectionRange, isCut: boolean): void {
        const rMin = Math.min(range.start.row, range.end.row);
        const rMax = Math.max(range.start.row, range.end.row);
        const cMin = Math.min(range.start.col, range.end.col);
        const cMax = Math.max(range.start.col, range.end.col);

        const cells: (CellData | null)[][] = [];
        for (let r = rMin; r <= rMax; r++) {
            const row: (CellData | null)[] = [];
            for (let c = cMin; c <= cMax; c++) {
                row.push(this._getCell(r, c));
            }
            cells.push(row);
        }

        this._buffer = {
            cells,
            rowCount: rMax - rMin + 1,
            colCount: cMax - cMin + 1,
            isCut,
            sourceRange: range,
        };

        this._cutSource = isCut ? range : null;
        this._notifyCutSource();

        navigator.clipboard?.writeText(this._serializeTSV(cells)).catch(() => {
            // 시스템 클립보드 쓰기 실패 시에도 내부 버퍼는 유효
        });
    }

    // ── 붙여넣기 ──────────────────────────────────────────────────────────────

    private _pasteFromBuffer(): void {
        if (this._buffer) {
            this._executePaste("all");
            return;
        }

        // 내부 버퍼 없음 → 시스템 클립보드에서 TSV 파싱
        navigator.clipboard
            ?.readText()
            .then((text) => {
                if (!text) return;
                this._pasteFromTSV(text);
            })
            .catch(() => {
                // 클립보드 읽기 권한 없음
            });
    }

    private _openPasteSpecial(): void {
        if (!this._buffer) return;
        this._notifyPasteSpecial({ isOpen: true, mode: "all" });
    }

    private _executePaste(mode: PasteMode): void {
        if (!this._buffer) return;

        const activeCell = this._selection.getActiveCell();
        if (!activeCell) return;

        const { cells, rowCount, colCount, isCut, sourceRange } = this._buffer;

        this._history.beginBatch("paste");

        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const targetRow = activeCell.row + r;
                const targetCol = activeCell.col + c;
                const after = this._buildAfter(
                    mode,
                    cells[r][c],
                    targetRow,
                    targetCol,
                );
                this._history.execute(
                    this._makeCellCmd(targetRow, targetCol, after),
                );
            }
        }

        // 잘라내기였으면 소스 셀 비우기 (같은 batch → 한 번에 undo 가능)
        if (isCut && sourceRange) {
            const rMin = Math.min(sourceRange.start.row, sourceRange.end.row);
            const rMax = Math.max(sourceRange.start.row, sourceRange.end.row);
            const cMin = Math.min(sourceRange.start.col, sourceRange.end.col);
            const cMax = Math.max(sourceRange.start.col, sourceRange.end.col);

            for (let r = rMin; r <= rMax; r++) {
                for (let c = cMin; c <= cMax; c++) {
                    this._history.execute(this._makeCellCmd(r, c, null));
                }
            }

            this._buffer = null;
            this._cutSource = null;
            this._notifyCutSource();
        }

        this._history.endBatch();
    }

    private _pasteFromTSV(text: string): void {
        const activeCell = this._selection.getActiveCell();
        if (!activeCell) return;

        const rows = this._parseTSV(text);
        if (rows.length === 0) return;

        this._history.beginBatch("paste");

        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const after: CellData = { value: rows[r][c] };
                this._history.execute(
                    this._makeCellCmd(
                        activeCell.row + r,
                        activeCell.col + c,
                        after,
                    ),
                );
            }
        }

        this._history.endBatch();
    }

    // ── 붙여넣기 모드별 셀 데이터 구성 ────────────────────────────────────────

    private _buildAfter(
        mode: PasteMode,
        source: CellData | null,
        targetRow: number,
        targetCol: number,
    ): CellData | null {
        if (mode === "all") return source;

        if (mode === "values") {
            if (!source) return null;
            return { value: source.value };
        }

        if (mode === "formulas") {
            if (!source) return null;
            return { value: source.value, formula: source.formula };
        }

        // 'formats': 대상 셀의 값은 유지, 서식만 교체
        if (mode === "formats") {
            const target = this._getCell(targetRow, targetCol);
            if (!source?.style) return target;
            return target
                ? { ...target, style: source.style }
                : { value: null, style: source.style };
        }

        return source;
    }

    // ── Command 생성 헬퍼 ─────────────────────────────────────────────────────

    private _makeCellCmd(
        row: number,
        col: number,
        after: CellData | null,
    ): Command {
        const before = this._getCell(row, col); // execute() 전에 현재 상태 캡처
        return {
            execute: () => this._setCell(row, col, after),
            undo: () => this._setCell(row, col, before),
            description: `cell(${row},${col})`,
        };
    }

    // ── TSV 직렬화 / 파싱 ─────────────────────────────────────────────────────

    private _serializeTSV(cells: (CellData | null)[][]): string {
        return cells
            .map((row) =>
                row.map((cell) => this._escapeForTSV(cell)).join("\t"),
            )
            .join("\n");
    }

    private _escapeForTSV(cell: CellData | null): string {
        const str = String(cell?.value ?? "");
        // 탭·줄바꿈·쌍따옴표 포함 시 인용 처리
        if (str.includes("\t") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * TSV 파싱. 엑셀 호환: \r\n 행 구분자, 쌍따옴표 인용 지원.
     */
    private _parseTSV(text: string): string[][] {
        // 줄바꿈 정규화 및 말미 빈 줄 제거
        const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const trimmed = normalized.endsWith("\n")
            ? normalized.slice(0, -1)
            : normalized;
        if (!trimmed) return [[""]];

        return trimmed.split("\n").map((line) => this._parseTSVRow(line));
    }

    private _parseTSVRow(line: string): string[] {
        const cols: string[] = [];
        let current = "";
        let inQuote = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (inQuote) {
                if (ch === '"') {
                    if (line[i + 1] === '"') {
                        current += '"';
                        i++; // 이스케이프된 쌍따옴표
                    } else {
                        inQuote = false;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuote = true;
                } else if (ch === "\t") {
                    cols.push(current);
                    current = "";
                } else {
                    current += ch;
                }
            }
        }
        cols.push(current);
        return cols;
    }

    // ── 이벤트 알림 ───────────────────────────────────────────────────────────

    private _notifyCutSource(): void {
        for (const fn of this._cutSourceListeners) fn(this._cutSource);
    }

    private _notifyPasteSpecial(state: PasteSpecialState): void {
        for (const fn of this._pasteSpecialListeners) fn(state);
    }
}
