import type {
    CellData,
    BorderStyle,
    CellRange,
    CellStyle,
} from "@cellix/shared";
import type { ViewportManager } from "../viewport";
import { styleManager } from "../style/StyleManager";
import { NumberFormatter } from "../style/NumberFormatter";
import { conditionalFormatManager } from "../conditional";
import type { CondFmtCellResult } from "../conditional";
import { filterManager } from "../data";
import { tableManager, TableStyleRenderer } from "../table";

function borderLineWidth(style: BorderStyle): number {
    switch (style) {
        case "hair":
            return 0.5;
        case "thin":
            return 1;
        case "medium":
        case "dashed":
        case "dotted":
        case "mediumDashed":
        case "dashDot":
        case "mediumDashDot":
        case "slantDashDot":
            return 2;
        case "thick":
        case "double":
            return 3;
        default:
            return 1;
    }
}

/**
 * 스프레드시트 그리드를 캔버스에 그리는 렌더러.
 *
 * 매 프레임 draw()를 호출하면 다음 순서로 그림:
 *   1. 흰색 배경
 *   2. 셀 배경색 + 조건부 서식 배경 + 데이터 막대 (격자선 아래)
 *   3. 격자선
 *   4. 셀 텍스트 + 밑줄/취소선 + 개별 테두리 (조건부 서식 스타일 오버레이)
 */
export class GridRenderer {
    private readonly _viewport: ViewportManager;
    private readonly _getCell: (row: number, col: number) => CellData | null;
    private readonly _getCalcVal: (
        row: number,
        col: number,
    ) => string | number | boolean | null;
    private readonly _getSheetId: () => string;

    constructor(
        viewport: ViewportManager,
        getCell: (row: number, col: number) => CellData | null,
        getCalculatedValue: (
            row: number,
            col: number,
        ) => string | number | boolean | null,
        getSheetId: () => string,
    ) {
        this._viewport = viewport;
        this._getCell = getCell;
        this._getCalcVal = getCalculatedValue;
        this._getSheetId = getSheetId;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const { viewWidth, viewHeight } = this._viewport.getState();
        const sheetId = this._getSheetId();

        // 조건부 서식 평가에 사용할 getCellValues 콜백
        const getCellValues = (
            _: string,
            range: CellRange,
        ): (string | number | boolean | null)[] => {
            const values: (string | number | boolean | null)[] = [];
            const r1 = Math.min(range.start.row, range.end.row);
            const r2 = Math.max(range.start.row, range.end.row);
            const c1 = Math.min(range.start.col, range.end.col);
            const c2 = Math.max(range.start.col, range.end.col);
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    const cell = this._getCell(r, c);
                    const calcVal = this._getCalcVal(r, c);
                    values.push(
                        calcVal !== null && calcVal !== undefined
                            ? calcVal
                            : (cell?.value ?? null),
                    );
                }
            }
            return values;
        };

        // 1. 흰색 배경
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewWidth, viewHeight);

        // 보이는 행/열 수집 (O(보이는 셀) 렌더링)
        const rows: { row: number; y: number; h: number }[] = [];
        const cols: { col: number; x: number; w: number }[] = [];
        this._viewport.iterateRows((row, y, h) => rows.push({ row, y, h }));
        this._viewport.iterateCols((col, x, w) => cols.push({ col, x, w }));

        // 2. 셀 배경색 + 조건부 서식 배경 + 데이터 막대
        //    (격자선보다 먼저 그려야 격자선이 위에 보임)
        //    이 패스에서 condFmt 결과를 캐시해 텍스트 패스에서 재사용
        const cfCache = new Map<string, CondFmtCellResult>();

        for (const { row, y, h } of rows) {
            for (const { col, x, w } of cols) {
                const cell = this._getCell(row, col);
                const calcVal = this._getCalcVal(row, col);
                const rawValue =
                    calcVal !== null && calcVal !== undefined
                        ? calcVal
                        : (cell?.value ?? null);

                const cfResult = conditionalFormatManager.evaluateCell(
                    sheetId,
                    row,
                    col,
                    rawValue,
                    getCellValues,
                );
                cfCache.set(`${row}:${col}`, cfResult);

                const baseStyle = styleManager.getStyle(sheetId, row, col);

                // 표 스타일 (우선순위 최하위)
                const _tbl = tableManager.getTableAt(sheetId, row, col);
                const _tblStyle = _tbl
                    ? TableStyleRenderer.getCellStyleForTable(_tbl, row, col)
                    : null;

                // 배경색: 조건부 서식 > 명시적 스타일 > 표 스타일
                const bgColor =
                    cfResult.style?.backgroundColor ??
                    baseStyle.backgroundColor ??
                    _tblStyle?.backgroundColor;
                if (bgColor) {
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(x, y, w, h);
                }

                // 데이터 막대 (반투명 50%)
                if (
                    cfResult.dataBarWidth !== undefined &&
                    cfResult.dataBarWidth > 0 &&
                    cfResult.dataBarColor
                ) {
                    ctx.fillStyle = cfResult.dataBarColor + "80";
                    ctx.fillRect(x, y, (w * cfResult.dataBarWidth) / 100, h);
                }
            }
        }

        // 3. 격자선 — 픽셀 정렬을 위해 +0.5 오프셋
        ctx.strokeStyle = "#d0d7de";
        ctx.lineWidth = 0.5;
        ctx.beginPath();

        for (const { y, h } of rows) {
            const lineY = Math.floor(y + h) + 0.5;
            ctx.moveTo(0, lineY);
            ctx.lineTo(viewWidth, lineY);
        }

        for (const { x, w } of cols) {
            const lineX = Math.floor(x + w) + 0.5;
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, viewHeight);
        }

        ctx.stroke();

        // 4. 셀 내용 (클립 영역 내)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, viewWidth, viewHeight);
        ctx.clip();
        ctx.textBaseline = "middle";

        for (const { row, y, h } of rows) {
            for (const { col, x, w } of cols) {
                const cell = this._getCell(row, col);
                const calcVal = this._getCalcVal(row, col);
                const baseStyle = styleManager.getStyle(sheetId, row, col);
                const cfResult = cfCache.get(`${row}:${col}`) ?? {};

                // 표 스타일 조회 (배경 패스와 별도로 다시 조회 — 텍스트 패스 루프)
                const tblAt = tableManager.getTableAt(sheetId, row, col);
                const tblStyle = tblAt
                    ? TableStyleRenderer.getCellStyleForTable(tblAt, row, col)
                    : null;

                // 우선순위: cfResult > baseStyle > tblStyle
                const mergedBase: CellStyle = tblStyle
                    ? {
                          ...tblStyle,
                          ...baseStyle,
                          font: { ...tblStyle.font, ...baseStyle.font },
                      }
                    : baseStyle;

                const style: CellStyle = cfResult.style
                    ? {
                          ...mergedBase,
                          ...cfResult.style,
                          font: cfResult.style.font
                              ? { ...mergedBase.font, ...cfResult.style.font }
                              : mergedBase.font,
                      }
                    : mergedBase;

                const rawValue =
                    calcVal !== null && calcVal !== undefined
                        ? calcVal
                        : (cell?.value ?? null);

                // 4a. 폰트 설정
                const font = style.font ?? {};
                const fontStyleStr =
                    font.style === "italic" ? "italic" : "normal";
                const fontWeight = font.weight === "bold" ? "bold" : "normal";
                const fontSize = font.size ?? 13;
                const fontFamily =
                    font.family ?? "system-ui, -apple-system, sans-serif";
                ctx.font = `${fontStyleStr} ${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = font.color ?? "#1f2329";

                // 4b. 숫자 포맷 적용
                const displayText =
                    style.numberFormat && rawValue !== null
                        ? NumberFormatter.format(rawValue, style.numberFormat)
                        : rawValue !== null
                          ? String(rawValue)
                          : "";

                // 4c. 수평 정렬
                const isNumeric = typeof rawValue === "number";
                const ha = style.horizontalAlign ?? "general";
                let textAlign: CanvasTextAlign;
                let textX: number;

                if (ha === "center") {
                    textAlign = "center";
                    textX = x + w / 2;
                } else if (ha === "right" || (ha === "general" && isNumeric)) {
                    textAlign = "right";
                    textX = x + w - 4;
                } else {
                    textAlign = "left";
                    textX = x + 4;
                }
                ctx.textAlign = textAlign;

                // 4d. 텍스트 그리기
                if (displayText) {
                    ctx.fillText(displayText, textX, y + h / 2, w - 8);

                    // 4e. 밑줄 / 취소선 (Canvas는 textDecoration 미지원 → 직접 그림)
                    const decoration = font.decoration;
                    if (
                        decoration === "underline" ||
                        decoration === "line-through"
                    ) {
                        const metrics = ctx.measureText(displayText);
                        const textW = Math.min(metrics.width, w - 8);

                        let lineStartX: number;
                        if (textAlign === "right") lineStartX = textX - textW;
                        else if (textAlign === "center")
                            lineStartX = textX - textW / 2;
                        else lineStartX = textX;

                        const lineY =
                            decoration === "underline"
                                ? y + h / 2 + fontSize * 0.55
                                : y + h / 2;

                        ctx.save();
                        ctx.strokeStyle = font.color ?? "#1f2329";
                        ctx.lineWidth = Math.max(0.5, fontSize / 13);
                        ctx.beginPath();
                        ctx.moveTo(lineStartX, lineY);
                        ctx.lineTo(lineStartX + textW, lineY);
                        ctx.stroke();
                        ctx.restore();
                    }
                }

                // 4f. 자동 필터 ▼ 아이콘 (헤더 행 — filterManager 기반)
                const _af = filterManager.getAutoFilter(sheetId);
                if (
                    _af &&
                    row === _af.headerRow &&
                    col >= _af.startCol &&
                    col <= _af.endCol
                ) {
                    const hasFilter = _af.criteria.has(col);
                    ctx.save();
                    ctx.fillStyle = hasFilter ? "#1a73e8" : "#5f6368";
                    ctx.font = `9px system-ui, -apple-system, sans-serif`;
                    ctx.textAlign = "right";
                    ctx.textBaseline = "middle";
                    ctx.fillText("▼", x + w - 3, y + h / 2);
                    ctx.restore();
                }

                // 4f-2. 표 헤더 행 ▼ 아이콘
                if (
                    tblAt &&
                    tblAt.showHeaderRow &&
                    row === tblAt.range.start.row
                ) {
                    ctx.save();
                    ctx.fillStyle = "#5f6368";
                    ctx.font = `9px system-ui, -apple-system, sans-serif`;
                    ctx.textAlign = "right";
                    ctx.textBaseline = "middle";
                    ctx.fillText("▼", x + w - 3, y + h / 2);
                    ctx.restore();
                }

                // 4g. 개별 셀 테두리 (격자선 위에 그림)
                if (style.border) {
                    const b = style.border;
                    ctx.save();
                    if (b.top && b.top.style !== "none") {
                        ctx.strokeStyle = b.top.color;
                        ctx.lineWidth = borderLineWidth(b.top.style);
                        ctx.beginPath();
                        ctx.moveTo(x, y + 0.5);
                        ctx.lineTo(x + w, y + 0.5);
                        ctx.stroke();
                    }
                    if (b.bottom && b.bottom.style !== "none") {
                        ctx.strokeStyle = b.bottom.color;
                        ctx.lineWidth = borderLineWidth(b.bottom.style);
                        ctx.beginPath();
                        ctx.moveTo(x, y + h - 0.5);
                        ctx.lineTo(x + w, y + h - 0.5);
                        ctx.stroke();
                    }
                    if (b.left && b.left.style !== "none") {
                        ctx.strokeStyle = b.left.color;
                        ctx.lineWidth = borderLineWidth(b.left.style);
                        ctx.beginPath();
                        ctx.moveTo(x + 0.5, y);
                        ctx.lineTo(x + 0.5, y + h);
                        ctx.stroke();
                    }
                    if (b.right && b.right.style !== "none") {
                        ctx.strokeStyle = b.right.color;
                        ctx.lineWidth = borderLineWidth(b.right.style);
                        ctx.beginPath();
                        ctx.moveTo(x + w - 0.5, y);
                        ctx.lineTo(x + w - 0.5, y + h);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
        }

        ctx.restore();
    }
}
