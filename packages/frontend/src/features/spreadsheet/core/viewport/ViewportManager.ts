import { SizeStore } from "./SizeStore";
import type {
    CellCoord,
    PixelPoint,
    ViewportListener,
    ViewportRange,
    ViewportState,
} from "./types";

// ── 엑셀 스펙 최대 크기 ──────────────────────────────────────────────────────
export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;
export const DEFAULT_ROW_HEIGHT = 20; // px
export const DEFAULT_COL_WIDTH = 80; // px

// 행/열 비율에 맞게 조정된 SizeStore 청크 크기
const ROW_CHUNK = 512; // 1M 행 → 2048 청크
const COL_CHUNK = 128; // 16K 열 → 128 청크

/**
 * 스프레드시트 캔버스의 가상 스크롤 뷰포트를 관리.
 *
 * 담당 역할:
 *   - 스크롤 위치(scrollX, scrollY)와 캔버스 크기 추적
 *   - 스크롤/리사이즈 시마다 보이는 셀 범위 계산
 *   - RAF 배칭을 통해 구독자에게 변경 알림
 *   - O(log n + CHUNK) 복잡도의 cellToPixel / pixelToCell 변환 제공
 *
 * 메모리 사용량:
 *   rowHeights Uint16Array   ~2 MB
 *   colWidths  Uint16Array   ~32 KB
 *   청크 합계 Float64Array   ~16 KB + ~1 KB
 */
export class ViewportManager {
    private scrollX = 0;
    private scrollY = 0;
    private viewWidth = 800;
    private viewHeight = 600;

    private readonly rows: SizeStore;
    private readonly cols: SizeStore;

    private range: ViewportRange = {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        offsetY: 0,
        offsetX: 0,
    };

    private rafId: number | null = null;
    private dirty = false;

    private hiddenRows = new Set<number>();
    private readonly savedHeights = new Map<number, number>();

    private readonly listeners = new Set<ViewportListener>();

    constructor(viewWidth = 800, viewHeight = 600) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.rows = new SizeStore(MAX_ROWS, DEFAULT_ROW_HEIGHT, ROW_CHUNK);
        this.cols = new SizeStore(MAX_COLS, DEFAULT_COL_WIDTH, COL_CHUNK);
        this._recalculate();
    }

    // ── 구독 ──────────────────────────────────────────────────────────────────

    /** 뷰포트 변경을 구독. 구독 해제 함수를 반환. */
    subscribe(listener: ViewportListener): () => void {
        this.listeners.add(listener);
        listener(this._buildState());
        return () => this.listeners.delete(listener);
    }

    // ── 스크롤 & 리사이즈 ─────────────────────────────────────────────────────

    scrollTo(x: number, y: number): void {
        this.scrollX = Math.max(
            0,
            Math.min(x, this.cols.getTotalSize() - this.viewWidth),
        );
        this.scrollY = Math.max(
            0,
            Math.min(y, this.rows.getTotalSize() - this.viewHeight),
        );
        this._schedule();
    }

    scrollBy(dx: number, dy: number): void {
        this.scrollTo(this.scrollX + dx, this.scrollY + dy);
    }

    resize(width: number, height: number): void {
        this.viewWidth = Math.max(1, width);
        this.viewHeight = Math.max(1, height);
        this._schedule();
    }

    // ── 행 / 열 크기 ──────────────────────────────────────────────────────────

    setRowHeight(row: number, height: number): void {
        this.rows.setSize(row, height);
        this._schedule();
    }

    setColWidth(col: number, width: number): void {
        this.cols.setSize(col, width);
        this._schedule();
    }

    getRowHeight(row: number): number {
        return this.rows.getSize(row);
    }

    getColWidth(col: number): number {
        return this.cols.getSize(col);
    }

    /** 숨길 행 집합을 교체. 이전에 숨겼던 행은 원래 높이로 복원됨. */
    setHiddenRows(rows: Set<number>): void {
        // 이전 숨김 행 중 새 목록에 없는 것은 복원
        for (const row of this.hiddenRows) {
            if (!rows.has(row)) {
                const saved = this.savedHeights.get(row) ?? DEFAULT_ROW_HEIGHT;
                this.rows.setSize(row, saved);
                this.savedHeights.delete(row);
            }
        }
        // 새로 숨길 행의 현재 높이를 저장하고 0으로 설정
        for (const row of rows) {
            if (!this.hiddenRows.has(row)) {
                this.savedHeights.set(
                    row,
                    this.rows.getSize(row) || DEFAULT_ROW_HEIGHT,
                );
                this.rows.setSize(row, 0);
            }
        }
        this.hiddenRows = new Set(rows);
        this._schedule();
    }

    // ── 좌표 변환 ─────────────────────────────────────────────────────────────

    /**
     * 셀의 좌측 상단 모서리에 해당하는 캔버스 픽셀 좌표를 반환.
     * 셀이 뷰포트 위/왼쪽으로 스크롤된 경우 음수가 될 수 있음.
     */
    cellToPixel(row: number, col: number): PixelPoint {
        return {
            x: this.cols.getOffset(col) - this.scrollX,
            y: this.rows.getOffset(row) - this.scrollY,
        };
    }

    /**
     * 캔버스 픽셀 좌표에 해당하는 셀 주소를 반환.
     * [0, MAX_ROWS/COLS - 1] 범위로 클램핑됨.
     */
    pixelToCell(x: number, y: number): CellCoord {
        return {
            row: this.rows.findIndex(y + this.scrollY).index,
            col: this.cols.findIndex(x + this.scrollX).index,
        };
    }

    // ── 뷰포트 순회 (렌더러용) ───────────────────────────────────────────────

    /**
     * 보이는 행을 미리 계산된 캔버스 Y 좌표와 높이로 순회.
     * O(endRow - startRow) — 셀마다 getOffset()을 호출하지 않아 빠름.
     */
    iterateRows(cb: (row: number, y: number, height: number) => void): void {
        const { startRow, endRow, offsetY } = this.range;
        let y = offsetY;
        for (let row = startRow; row <= endRow; row++) {
            const h = this.rows.getSize(row);
            if (h > 0) cb(row, y, h);
            y += h;
        }
    }

    /**
     * 보이는 열을 미리 계산된 캔버스 X 좌표와 너비로 순회.
     * O(endCol - startCol) — 셀마다 getOffset()을 호출하지 않아 빠름.
     */
    iterateCols(cb: (col: number, x: number, width: number) => void): void {
        const { startCol, endCol, offsetX } = this.range;
        let x = offsetX;
        for (let col = startCol; col <= endCol; col++) {
            const w = this.cols.getSize(col);
            cb(col, x, w);
            x += w;
        }
    }

    // ── 상태 접근자 ───────────────────────────────────────────────────────────

    getState(): ViewportState {
        return this._buildState();
    }

    getRange(): Readonly<ViewportRange> {
        return this.range;
    }

    getTotalWidth(): number {
        return this.cols.getTotalSize();
    }

    getTotalHeight(): number {
        return this.rows.getTotalSize();
    }

    getScrollX(): number {
        return this.scrollX;
    }
    getScrollY(): number {
        return this.scrollY;
    }

    /**
     * 대기 중인 RAF 업데이트를 동기적으로 강제 실행.
     * 테스트 환경 또는 휠 이벤트에 즉각 반응이 필요할 때 사용.
     */
    flush(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.dirty) {
            this.dirty = false;
            this._recalculate();
            this._notify();
        }
    }

    destroy(): void {
        this.flush();
        this.listeners.clear();
    }

    // ── 내부 메서드 ───────────────────────────────────────────────────────────

    private _schedule(): void {
        this.dirty = true;
        if (this.rafId !== null) return;

        // SSR / 테스트 환경(RAF 미지원) 대응 폴백
        if (typeof requestAnimationFrame === "undefined") {
            this.dirty = false;
            this._recalculate();
            this._notify();
            return;
        }

        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            if (this.dirty) {
                this.dirty = false;
                this._recalculate();
                this._notify();
            }
        });
    }

    private _recalculate(): void {
        // 차원당 O(log C + CHUNK) — 16ms 예산 내 처리 보장
        const { index: startRow, offset: rowPixelOffset } = this.rows.findIndex(
            this.scrollY,
        );
        const { index: endRow } = this.rows.findIndex(
            this.scrollY + this.viewHeight,
        );

        const { index: startCol, offset: colPixelOffset } = this.cols.findIndex(
            this.scrollX,
        );
        const { index: endCol } = this.cols.findIndex(
            this.scrollX + this.viewWidth,
        );

        this.range = {
            startRow,
            endRow: Math.min(endRow + 1, MAX_ROWS - 1), // +1: 부분적으로 보이는 행 포함
            startCol,
            endCol: Math.min(endCol + 1, MAX_COLS - 1),
            offsetY: rowPixelOffset - this.scrollY,
            offsetX: colPixelOffset - this.scrollX,
        };
    }

    private _buildState(): ViewportState {
        return {
            scrollX: this.scrollX,
            scrollY: this.scrollY,
            viewWidth: this.viewWidth,
            viewHeight: this.viewHeight,
            range: { ...this.range },
        };
    }

    private _notify(): void {
        const state = this._buildState();
        for (const fn of this.listeners) fn(state);
    }
}
