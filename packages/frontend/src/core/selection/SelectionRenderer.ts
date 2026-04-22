import type { ViewportManager } from "../viewport/ViewportManager";
import type { ViewportRange } from "../viewport/types";
import type { SelectionRange } from "./types";
import { RANGE_COLORS } from "./types";

// 각 테두리 색상에 대응하는 15% 알파 채우기 색상
const FILL_MAP: Readonly<Record<string, string>> = {
    "#4B87FF": "rgba(75,135,255,0.15)",
    "#00CC66": "rgba(0,204,102,0.15)",
    "#FF8C00": "rgba(255,140,0,0.15)",
    "#9B59B6": "rgba(155,89,182,0.15)",
    "#E74C3C": "rgba(231,76,60,0.15)",
};

const DEFAULT_FILL = FILL_MAP[RANGE_COLORS[0]];

/**
 * 선택 영역을 캔버스에 그리는 렌더러.
 *
 * - markDirty()로 다시 그려야 함을 알림.
 * - drawSelections()를 rAF 루프에서 매 프레임 호출하되,
 *   dirty 플래그가 true일 때만 실제로 그림.
 * - 활성 커서(activeCell)는 굵은 파란 테두리로 표시.
 */
export class SelectionRenderer {
    private dirty = false;
    private readonly vp: ViewportManager;

    constructor(viewport: ViewportManager) {
        this.vp = viewport;
    }

    markDirty(): void {
        this.dirty = true;
    }

    isDirty(): boolean {
        return this.dirty;
    }

    /**
     * 선택 영역을 캔버스에 그림. dirty가 false면 즉시 반환.
     *
     * rAF 루프의 clear → 그리드 → drawSelections 순서로 호출.
     * 선택이 변경되지 않았으면 rAF 예산을 소비하지 않음.
     */
    drawSelections(
        ctx: CanvasRenderingContext2D,
        selections: SelectionRange[],
        activeCell: { row: number; col: number } | null = null,
    ): void {
        if (!this.dirty) return;
        this.dirty = false;

        const vpRange = this.vp.getRange();
        const { viewWidth, viewHeight } = this.vp.getState();

        ctx.save();

        for (const sel of selections) {
            this._drawRange(ctx, sel, vpRange, viewWidth, viewHeight);
        }

        if (activeCell !== null) {
            this._drawCursor(ctx, activeCell, vpRange, viewWidth, viewHeight);
        }

        ctx.restore();
    }

    // ── 내부 ─────────────────────────────────────────────────────────────────

    private _drawRange(
        ctx: CanvasRenderingContext2D,
        sel: SelectionRange,
        vpRange: Readonly<ViewportRange>,
        viewWidth: number,
        viewHeight: number,
    ): void {
        const r1 = Math.min(sel.start.row, sel.end.row);
        const r2 = Math.max(sel.start.row, sel.end.row);
        const c1 = Math.min(sel.start.col, sel.end.col);
        const c2 = Math.max(sel.start.col, sel.end.col);

        // 뷰포트와 전혀 겹치지 않으면 스킵
        if (r2 < vpRange.startRow || r1 > vpRange.endRow) return;
        if (c2 < vpRange.startCol || c1 > vpRange.endCol) return;

        const topLeft = this.vp.cellToPixel(r1, c1);
        const endOrigin = this.vp.cellToPixel(r2, c2);
        const w = endOrigin.x + this.vp.getColWidth(c2) - topLeft.x;
        const h = endOrigin.y + this.vp.getRowHeight(r2) - topLeft.y;

        // 캔버스 밖으로 완전히 벗어난 경우 스킵
        if (topLeft.x + w <= 0 || topLeft.y + h <= 0) return;
        if (topLeft.x >= viewWidth || topLeft.y >= viewHeight) return;

        const borderColor = sel.color ?? RANGE_COLORS[0];
        const fillColor = FILL_MAP[borderColor] ?? DEFAULT_FILL;

        // 반투명 배경
        ctx.fillStyle = fillColor;
        ctx.fillRect(topLeft.x, topLeft.y, w, h);

        // 선택 테두리 (0.5 오프셋으로 선명한 1px)
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(topLeft.x + 0.5, topLeft.y + 0.5, w - 1, h - 1);
    }

    private _drawCursor(
        ctx: CanvasRenderingContext2D,
        cell: { row: number; col: number },
        vpRange: Readonly<ViewportRange>,
        viewWidth: number,
        viewHeight: number,
    ): void {
        const { row, col } = cell;

        if (row < vpRange.startRow || row > vpRange.endRow) return;
        if (col < vpRange.startCol || col > vpRange.endCol) return;

        const { x, y } = this.vp.cellToPixel(row, col);
        const w = this.vp.getColWidth(col);
        const h = this.vp.getRowHeight(row);

        if (x + w <= 0 || y + h <= 0 || x >= viewWidth || y >= viewHeight) return;

        // 활성 셀 커서: 안쪽 2px 굵은 파란 테두리
        ctx.strokeStyle = RANGE_COLORS[0];
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
}
