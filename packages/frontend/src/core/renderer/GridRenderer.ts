import type { CellData } from '@cellix/shared'
import type { ViewportManager } from '../viewport'

/**
 * 스프레드시트 그리드를 캔버스에 그리는 렌더러.
 *
 * 매 프레임 draw()를 호출하면 다음 순서로 그림:
 *   1. 흰색 배경
 *   2. 격자선 (iterateRows/iterateCols 기반, O(보이는 셀))
 *   3. 셀 텍스트 (숫자: 오른쪽 정렬, 문자: 왼쪽 정렬)
 */
export class GridRenderer {
    private readonly _viewport: ViewportManager
    private readonly _getCell: (row: number, col: number) => CellData | null
    private readonly _getCalcVal: (row: number, col: number) => string | number | boolean | null

    constructor(
        viewport: ViewportManager,
        getCell: (row: number, col: number) => CellData | null,
        getCalculatedValue: (row: number, col: number) => string | number | boolean | null,
    ) {
        this._viewport = viewport
        this._getCell = getCell
        this._getCalcVal = getCalculatedValue
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const { viewWidth, viewHeight } = this._viewport.getState()

        // 배경
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, viewWidth, viewHeight)

        // 보이는 행/열의 좌표를 미리 수집 (O(보이는 셀) 렌더링)
        const rows: { row: number; y: number; h: number }[] = []
        const cols: { col: number; x: number; w: number }[] = []

        this._viewport.iterateRows((row, y, h) => rows.push({ row, y, h }))
        this._viewport.iterateCols((col, x, w) => cols.push({ col, x, w }))

        // 격자선 — 픽셀 정렬을 위해 +0.5 오프셋
        ctx.strokeStyle = '#d0d7de'
        ctx.lineWidth = 0.5
        ctx.beginPath()

        for (const { y, h } of rows) {
            const lineY = Math.floor(y + h) + 0.5
            ctx.moveTo(0, lineY)
            ctx.lineTo(viewWidth, lineY)
        }

        for (const { x, w } of cols) {
            const lineX = Math.floor(x + w) + 0.5
            ctx.moveTo(lineX, 0)
            ctx.lineTo(lineX, viewHeight)
        }

        ctx.stroke()

        // 셀 텍스트
        ctx.font = '13px system-ui, -apple-system, sans-serif'
        ctx.textBaseline = 'middle'

        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, viewWidth, viewHeight)
        ctx.clip()

        for (const { row, y, h } of rows) {
            for (const { col, x, w } of cols) {
                const cell = this._getCell(row, col)
                const calcVal = this._getCalcVal(row, col)
                const displayValue = calcVal !== null && calcVal !== undefined
                    ? calcVal
                    : (cell?.value ?? null)
                const text = displayValue !== null ? String(displayValue) : ''
                if (!text) continue

                const isNumeric = typeof displayValue === 'number'
                ctx.fillStyle = cell?.style?.font?.color ?? '#1f2329'
                ctx.textAlign = isNumeric ? 'right' : 'left'
                ctx.fillText(
                    text,
                    isNumeric ? x + w - 4 : x + 4,
                    y + h / 2,
                    w - 8,
                )
            }
        }

        ctx.restore()
    }
}
