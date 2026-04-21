import { SizeStore } from "./SizeStore";
import type {
    CellCoord,
    PixelPoint,
    ViewportListener,
    ViewportRange,
    ViewportState,
} from "./types";

// ── Excel-spec dimensions ────────────────────────────────────────────────────
export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;
export const DEFAULT_ROW_HEIGHT = 20; // px
export const DEFAULT_COL_WIDTH = 80; // px

// SizeStore chunk sizes — tuned for the ratio of row vs col counts
const ROW_CHUNK = 512; // 2048 chunks for 1M rows
const COL_CHUNK = 128; // 128  chunks for 16K cols

/**
 * Manages the virtual scroll viewport for the spreadsheet canvas.
 *
 * Responsibilities:
 *   - Tracks scroll position (scrollX, scrollY) and canvas dimensions
 *   - Computes the visible cell range on every scroll/resize
 *   - Notifies subscribers via RAF-batched listener calls
 *   - Provides O(log n + CHUNK) cellToPixel / pixelToCell conversions
 *
 * Memory footprint:
 *   rowHeights Uint16Array   ~2 MB
 *   colWidths  Uint16Array   ~32 KB
 *   chunk sums Float64Array  ~16 KB + ~1 KB
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

    private readonly listeners = new Set<ViewportListener>();

    constructor(viewWidth = 800, viewHeight = 600) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.rows = new SizeStore(MAX_ROWS, DEFAULT_ROW_HEIGHT, ROW_CHUNK);
        this.cols = new SizeStore(MAX_COLS, DEFAULT_COL_WIDTH, COL_CHUNK);
        this._recalculate();
    }

    // ── Subscription ───────────────────────────────────────────────────────────

    /** Subscribe to viewport changes. Returns an unsubscribe function. */
    subscribe(listener: ViewportListener): () => void {
        this.listeners.add(listener);
        listener(this._buildState());
        return () => this.listeners.delete(listener);
    }

    // ── Scroll & Resize ────────────────────────────────────────────────────────

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

    // ── Row / Column Sizing ────────────────────────────────────────────────────

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

    // ── Coordinate Conversion ──────────────────────────────────────────────────

    /**
     * Returns the canvas pixel position of a cell's top-left corner.
     * Values can be negative when the cell is scrolled above/left of the viewport.
     */
    cellToPixel(row: number, col: number): PixelPoint {
        return {
            x: this.cols.getOffset(col) - this.scrollX,
            y: this.rows.getOffset(row) - this.scrollY,
        };
    }

    /**
     * Returns the cell address at a given canvas pixel coordinate.
     * Clamps to [0, MAX_ROWS/COLS - 1].
     */
    pixelToCell(x: number, y: number): CellCoord {
        return {
            row: this.rows.findIndex(y + this.scrollY).index,
            col: this.cols.findIndex(x + this.scrollX).index,
        };
    }

    // ── Viewport Iteration (for renderers) ────────────────────────────────────

    /**
     * Iterate visible rows with their pre-computed canvas Y and height.
     * O(endRow - startRow) — avoids per-cell getOffset() calls.
     */
    iterateRows(cb: (row: number, y: number, height: number) => void): void {
        const { startRow, endRow, offsetY } = this.range;
        let y = offsetY;
        for (let row = startRow; row <= endRow; row++) {
            const h = this.rows.getSize(row);
            cb(row, y, h);
            y += h;
        }
    }

    /**
     * Iterate visible columns with their pre-computed canvas X and width.
     * O(endCol - startCol) — avoids per-cell getOffset() calls.
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

    // ── State Accessors ────────────────────────────────────────────────────────

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
     * Force-flush any pending RAF update synchronously.
     * Useful in tests and in response to wheel events that need immediate feedback.
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

    // ── Internal ───────────────────────────────────────────────────────────────

    private _schedule(): void {
        this.dirty = true;
        if (this.rafId !== null) return;

        // Graceful fallback for SSR / test environments without RAF
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
        // O(log C + CHUNK) per dimension — well within 16ms budget
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
            endRow: Math.min(endRow + 1, MAX_ROWS - 1), // +1: include partially visible row
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
