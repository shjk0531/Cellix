import type { ViewportManager } from '../viewport'

/**
 * 그리드 배경(격자선, 셀 내용 등)을 OffscreenCanvas에 캐싱.
 * 스크롤/크기가 바뀌거나 invalidate()가 호출될 때만 재드로우하여 렌더 비용 절감.
 */
export class OffscreenLayer {
    private offscreen: OffscreenCanvas
    private ctx: OffscreenCanvasRenderingContext2D
    private dirty = true
    private lastScrollX = -1
    private lastScrollY = -1
    private lastWidth = 0
    private lastHeight = 0

    constructor(width: number, height: number) {
        this.offscreen = new OffscreenCanvas(width, height)
        this.ctx = this.offscreen.getContext('2d')!
    }

    /**
     * 배경을 메인 Canvas에 그림.
     * 스크롤/크기 변경 또는 invalidate() 호출 시에만 offscreen을 재드로우.
     */
    drawBackground(
        mainCtx: CanvasRenderingContext2D,
        viewport: ViewportManager,
        drawFn: (ctx: OffscreenCanvasRenderingContext2D) => void,
    ): void {
        const { scrollX, scrollY, viewWidth, viewHeight } = viewport.getState()
        const needsRedraw =
            this.dirty ||
            scrollX !== this.lastScrollX ||
            scrollY !== this.lastScrollY ||
            viewWidth !== this.lastWidth ||
            viewHeight !== this.lastHeight

        if (needsRedraw) {
            this.ctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height)
            drawFn(this.ctx)
            this.lastScrollX = scrollX
            this.lastScrollY = scrollY
            this.lastWidth = viewWidth
            this.lastHeight = viewHeight
            this.dirty = false
        }

        mainCtx.drawImage(this.offscreen, 0, 0)
    }

    invalidate(): void { this.dirty = true }

    resize(width: number, height: number): void {
        this.offscreen = new OffscreenCanvas(width, height)
        this.ctx = this.offscreen.getContext('2d')!
        this.dirty = true
    }
}
