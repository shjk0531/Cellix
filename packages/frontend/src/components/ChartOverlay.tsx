import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import * as echarts from 'echarts'
import type { CellData } from '@cellix/shared'
import type { ViewportManager } from '../core/viewport'
import type { ChartDefinition } from '../core/chart/types'
import { chartManager, buildEChartsOption } from '../core/chart'

// ── 위치 계산 ─────────────────────────────────────────────────────────────────

interface ChartPos {
    x: number
    y: number
    width: number
    height: number
}

function calcPos(chart: ChartDefinition, vp: ViewportManager): ChartPos {
    const { x, y } = vp.cellToPixel(chart.anchorRow, chart.anchorCol)
    let width = 0
    for (let c = chart.anchorCol; c < chart.anchorCol + chart.widthCols; c++) {
        width += vp.getColWidth(c)
    }
    let height = 0
    for (let r = chart.anchorRow; r < chart.anchorRow + chart.heightRows; r++) {
        height += vp.getRowHeight(r)
    }
    return { x, y, width: Math.max(80, width), height: Math.max(60, height) }
}

// ── 개별 차트 아이템 ──────────────────────────────────────────────────────────

interface ChartItemProps {
    chart: ChartDefinition
    pos: ChartPos
    viewport: ViewportManager
    getCell: (sheetId: string, row: number, col: number) => CellData | null
    isSelected: boolean
    onSelect: () => void
    dataVersion: number
}

function ChartItem({ chart, pos, viewport, getCell, isSelected, onSelect, dataVersion }: ChartItemProps) {
    const divRef = useRef<HTMLDivElement>(null)
    const instanceRef = useRef<echarts.ECharts | null>(null)

    // ECharts 인스턴스 초기화 (마운트 1회)
    useEffect(() => {
        if (!divRef.current) return
        const instance = echarts.init(divRef.current, undefined, { renderer: 'canvas' })
        instanceRef.current = instance
        instance.setOption(buildEChartsOption(chart, getCell))
        return () => {
            instance.dispose()
            instanceRef.current = null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 차트 데이터/설정 변경 시 옵션 갱신
    useEffect(() => {
        instanceRef.current?.setOption(buildEChartsOption(chart, getCell), { notMerge: true })
    }, [chart, getCell, dataVersion])

    // 크기 변경 시 ECharts resize
    useLayoutEffect(() => {
        instanceRef.current?.resize({ width: pos.width, height: pos.height })
    }, [pos.width, pos.height])

    // ── 드래그 이동 ────────────────────────────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // 리사이즈 핸들 영역 (우하단 12px) 은 드래그 제외
        const rect = e.currentTarget.getBoundingClientRect()
        if (e.clientX > rect.right - 12 && e.clientY > rect.bottom - 12) return

        onSelect()
        e.stopPropagation()
        e.preventDefault()

        const startClientX = e.clientX
        const startClientY = e.clientY
        const startCanvas = viewport.cellToPixel(chart.anchorRow, chart.anchorCol)

        const onMove = (me: MouseEvent) => {
            const dx = me.clientX - startClientX
            const dy = me.clientY - startClientY
            const { row, col } = viewport.pixelToCell(startCanvas.x + dx, startCanvas.y + dy)
            chartManager.updateChart(chart.id, {
                anchorRow: Math.max(0, row),
                anchorCol: Math.max(0, col),
            })
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [chart, viewport, onSelect])

    // ── 리사이즈 핸들 ─────────────────────────────────────────────────────────
    const handleResizeDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        onSelect()

        const startX = e.clientX
        const startY = e.clientY
        const startW = pos.width
        const startH = pos.height

        const onMove = (me: MouseEvent) => {
            const targetW = Math.max(80, startW + me.clientX - startX)
            const targetH = Math.max(60, startH + me.clientY - startY)

            let accW = 0, widthCols = 1
            for (let c = chart.anchorCol; c < chart.anchorCol + 50; c++) {
                accW += viewport.getColWidth(c)
                if (accW >= targetW) { widthCols = c - chart.anchorCol + 1; break }
            }
            let accH = 0, heightRows = 1
            for (let r = chart.anchorRow; r < chart.anchorRow + 100; r++) {
                accH += viewport.getRowHeight(r)
                if (accH >= targetH) { heightRows = r - chart.anchorRow + 1; break }
            }
            chartManager.updateChart(chart.id, { widthCols, heightRows })
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [chart, viewport, pos, onSelect])

    return (
        <div
            style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: pos.width,
                height: pos.height,
                boxSizing: 'border-box',
                border: isSelected ? '2px solid #1a73e8' : '1px solid #dadce0',
                background: '#ffffff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                cursor: 'move',
                userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
        >
            <div ref={divRef} style={{ width: '100%', height: '100%' }} />
            {isSelected && (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        width: 8,
                        height: 8,
                        background: '#1a73e8',
                        cursor: 'se-resize',
                        zIndex: 1,
                    }}
                    onMouseDown={handleResizeDown}
                />
            )}
        </div>
    )
}

// ── ChartOverlay 컴포넌트 ────────────────────────────────────────────────────

interface ChartOverlayProps {
    sheetId: string
    viewport: ViewportManager
    getCell: (sheetId: string, row: number, col: number) => CellData | null
    selectedChartId: string | null
    onChartSelect: (id: string | null) => void
    dataVersion: number
}

export function ChartOverlay({
    sheetId,
    viewport,
    getCell,
    selectedChartId,
    onChartSelect,
    dataVersion,
}: ChartOverlayProps) {
    const [charts, setCharts] = useState<ChartDefinition[]>(() =>
        chartManager.getChartsForSheet(sheetId),
    )
    const [, setVpTick] = useState(0)

    // 차트 목록 변경 구독
    useEffect(() => {
        return chartManager.subscribe(() => {
            setCharts(chartManager.getChartsForSheet(sheetId))
        })
    }, [sheetId])

    // 뷰포트 변경 구독 (스크롤/리사이즈 시 위치 재계산)
    useEffect(() => {
        return viewport.subscribe(() => setVpTick(t => t + 1))
    }, [viewport])

    return (
        <>
            {charts.map(chart => (
                <ChartItem
                    key={chart.id}
                    chart={chart}
                    pos={calcPos(chart, viewport)}
                    viewport={viewport}
                    getCell={getCell}
                    isSelected={selectedChartId === chart.id}
                    onSelect={() => onChartSelect(chart.id)}
                    dataVersion={dataVersion}
                />
            ))}
        </>
    )
}
