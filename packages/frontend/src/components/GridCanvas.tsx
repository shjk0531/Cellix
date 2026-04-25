import React, { useRef, useEffect } from 'react'
import type { CellData } from '@cellix/shared'
import { ViewportManager } from '../core/viewport'
import { SelectionManager, SelectionRenderer } from '../core/selection'
import type { SelectionRange, SelectionState } from '../core/selection'
import { InputManager } from '../core/input'
import { HistoryManager, ClipboardManager } from '../core/history'
import { GridRenderer } from '../core/renderer'
import { useWorkbookStore } from '../store/useWorkbookStore'
import { useUIStore } from '../store/useUIStore'
import { formulaEngine } from '../workers'

/**
 * 캔버스 기반 스프레드시트 그리드 컴포넌트.
 *
 * useEffect 안에서 다음 엔진 인스턴스를 생성하고 연결:
 *   ViewportManager — 가상 스크롤
 *   SelectionManager — 셀 선택
 *   InputManager     — 키보드·마우스 입력 (IME 오버레이 포함)
 *   HistoryManager   — Ctrl+Z/Y undo/redo
 *   ClipboardManager — Ctrl+C/X/V 복사/붙여넣기
 *   SelectionRenderer — 선택 영역 캔버스 렌더링
 *   GridRenderer      — 격자선·셀 내용 렌더링
 *
 * 변경사항은 useWorkbookStore / useUIStore로 푸시되어 다른 React 컴포넌트가 구독.
 */
export function GridCanvas() {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        if (!container || !canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let destroyed = false
        let cleanupFn: (() => void) | null = null

        ;(async () => {
            // ── formulaEngine 초기화 ──────────────────────────────────────────────
            await formulaEngine.initialize()
            if (destroyed) return
            const firstState = useWorkbookStore.getState()
            await formulaEngine.addSheet(firstState.activeSheetId, firstState.sheets[0].name)
            if (destroyed) return

            // ── 셀 데이터 콜백 (항상 현재 활성 시트 기준) ────────────────────────
            const getCell = (row: number, col: number): CellData | null => {
                const s = useWorkbookStore.getState()
                return s.getCell(s.activeSheetId, row, col)
            }

            const setCell = (row: number, col: number, data: CellData | null): void => {
                const s = useWorkbookStore.getState()
                s.setCell(s.activeSheetId, row, col, data)
            }

            const getCalculatedValue = (
                row: number,
                col: number,
            ): string | number | boolean | null => {
                const s = useWorkbookStore.getState()
                return s.calculatedValues[`${s.activeSheetId}:${row}:${col}`] ?? null
            }

            // ── 입력 확정 콜백 ────────────────────────────────────────────────────
            const onCommit = (row: number, col: number, value: string): void => {
                const s = useWorkbookStore.getState()
                const isFormula = value.startsWith('=')
                const cellData: CellData = {
                    value: isFormula ? null : parseTyped(value),
                    formula: isFormula ? value : undefined,
                }
                s.setCell(s.activeSheetId, row, col, cellData)
            }

            // ── 캔버스 초기 크기 설정 ────────────────────────────────────────────
            const initW = container.clientWidth || 800
            const initH = container.clientHeight || 600
            canvas.width = initW
            canvas.height = initH

            // ── 엔진 인스턴스 생성 ──────────────────────────────────────────────
            const viewport = new ViewportManager(initW, initH)
            const selection = new SelectionManager(useWorkbookStore.getState().activeSheetId)
            const input = new InputManager(canvas, container, viewport, selection, onCommit)
            const history = new HistoryManager()
            const clipboard = new ClipboardManager(selection, history, getCell, setCell)
            const selectionRenderer = new SelectionRenderer(viewport)
            const gridRenderer = new GridRenderer(
                viewport,
                getCell,
                getCalculatedValue,
                () => useWorkbookStore.getState().activeSheetId,
            )

            // ── formulaEngine.onChanged 구독 ─────────────────────────────────────
            const unsubFormula = formulaEngine.onChanged((changed) => {
                const prev = useWorkbookStore.getState().calculatedValues
                const next: Record<string, string | number | boolean | null> = { ...prev }
                for (const c of changed) {
                    const key = `${c.sheet_id}:${c.row}:${c.col}`
                    next[key] = c.value.t === 'nil' ? null : (c.value.v ?? null)
                }
                useWorkbookStore.getState().setCalculatedValues(next)
            })

            // ── RAF 렌더 루프용 로컬 상태 ────────────────────────────────────────
            let curSelections: SelectionRange[] = []
            let curActiveCell: { row: number; col: number } | null = null

            // ── 매니저 구독 ──────────────────────────────────────────────────────

            const unsubSelection = selection.subscribe((state: SelectionState) => {
                curSelections = state.selections
                curActiveCell = state.activeCell

                const ui = useUIStore.getState()
                ui.setSelectionState(state)
                ui.setActiveCellData(
                    state.activeCell ? getCell(state.activeCell.row, state.activeCell.col) : null,
                )
            })

            const unsubEdit = input.subscribeEdit((state) => {
                useUIStore.getState().setEditState(state)
                if (state.mode !== 'none' && curActiveCell) {
                    useUIStore.getState().setActiveCellData(
                        getCell(curActiveCell.row, curActiveCell.col),
                    )
                }
            })

            const unsubHistory = history.subscribe((state) => {
                useUIStore.getState().setHistoryState(state)
            })

            const unsubCut = clipboard.onCutSourceChange(() => {
                /* render loop reads getCutSource() */
            })

            // 시트 전환 시 SelectionManager sheetId 동기화
            const unsubWorkbook = useWorkbookStore.subscribe((state, prev) => {
                if (state.activeSheetId !== prev.activeSheetId) {
                    selection.setSheetId(state.activeSheetId)
                }
            })

            // ── 휠 스크롤 ─────────────────────────────────────────────────────────
            const onWheel = (e: WheelEvent) => {
                e.preventDefault()
                viewport.scrollBy(e.deltaX, e.deltaY)
            }
            canvas.addEventListener('wheel', onWheel, { passive: false })

            // ── 문서 레벨 단축키 ──────────────────────────────────────────────────
            const onKeyDown = (e: KeyboardEvent) => {
                const mod = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }

                if (history.handleKeyDown(e.key, mod)) {
                    e.preventDefault()
                    return
                }
                if (clipboard.handleKeyDown(e.key, mod)) {
                    e.preventDefault()
                }
            }
            document.addEventListener('keydown', onKeyDown)

            // ── ResizeObserver ────────────────────────────────────────────────────
            const observer = new ResizeObserver((entries) => {
                const { width, height } = entries[0].contentRect
                const w = Math.max(1, Math.floor(width))
                const h = Math.max(1, Math.floor(height))
                canvas.width = w
                canvas.height = h
                viewport.resize(w, h)
            })
            observer.observe(container)

            // ── RAF 렌더 루프 ─────────────────────────────────────────────────────
            let rafId = -1
            const renderLoop = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height)

                gridRenderer.draw(ctx)

                selectionRenderer.markDirty()
                selectionRenderer.drawSelections(ctx, curSelections, curActiveCell)

                const cutSource = clipboard.getCutSource()
                if (cutSource) {
                    _drawCutBorder(ctx, viewport, cutSource)
                }

                rafId = requestAnimationFrame(renderLoop)
            }
            rafId = requestAnimationFrame(renderLoop)

            // ── 정리 함수 등록 ────────────────────────────────────────────────────
            cleanupFn = () => {
                cancelAnimationFrame(rafId)
                observer.disconnect()
                document.removeEventListener('keydown', onKeyDown)
                canvas.removeEventListener('wheel', onWheel)
                unsubFormula()
                unsubSelection()
                unsubEdit()
                unsubHistory()
                unsubCut()
                unsubWorkbook()
                input.destroy()
                clipboard.destroy()
                history.destroy()
                selection.destroy()
                viewport.destroy()
            }
        })().catch(console.error)

        return () => {
            destroyed = true
            cleanupFn?.()
        }
    }, []) // 마운트 시 한 번만 실행

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    )
}

// ── 입력 값 타입 자동 판별 ────────────────────────────────────────────────────────

function parseTyped(v: string): string | number | boolean | null {
    if (v === '') return null
    if (v.toLowerCase() === 'true') return true
    if (v.toLowerCase() === 'false') return false
    const n = Number(v)
    if (!isNaN(n) && v.trim() !== '') return n
    return v
}

// ── 잘라내기 소스 점선 테두리 렌더링 ─────────────────────────────────────────────

function _drawCutBorder(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    source: SelectionRange,
): void {
    const r1 = Math.min(source.start.row, source.end.row)
    const r2 = Math.max(source.start.row, source.end.row)
    const c1 = Math.min(source.start.col, source.end.col)
    const c2 = Math.max(source.start.col, source.end.col)

    const tl = viewport.cellToPixel(r1, c1)
    const br = viewport.cellToPixel(r2, c2)
    const w = br.x + viewport.getColWidth(c2) - tl.x
    const h = br.y + viewport.getRowHeight(r2) - tl.y

    ctx.save()
    ctx.strokeStyle = '#1a73e8'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w - 1, h - 1)
    ctx.restore()
}
