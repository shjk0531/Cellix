import React, { useState } from 'react'
import type { CellRange } from '@cellix/shared'
import { chartManager } from '../../core/chart'
import type { ChartSeries, ChartType } from '../../core/chart'

interface Props {
    sheetId: string
    initialRange?: CellRange
    onClose: () => void
}

const CHART_TYPES: { type: ChartType; label: string; icon: string }[] = [
    { type: 'bar', label: '세로 막대형', icon: '▊' },
    { type: 'bar_stacked', label: '누적 막대형', icon: '▉' },
    { type: 'line', label: '꺾은선형', icon: '╱' },
    { type: 'pie', label: '원형', icon: '◕' },
    { type: 'scatter', label: '분산형', icon: '⁚' },
    { type: 'combo', label: '혼합형', icon: '╪' },
]

function colToLetter(col: number): string {
    let result = ''
    let n = col + 1
    while (n > 0) {
        const r = (n - 1) % 26
        result = String.fromCharCode(65 + r) + result
        n = Math.floor((n - 1) / 26)
    }
    return result
}

function rangeToCellRef(range: CellRange): string {
    const s = range.start
    const e = range.end
    return `${colToLetter(s.col)}${s.row + 1}:${colToLetter(e.col)}${e.row + 1}`
}

function parseRangeRef(ref: string, sheetId: string): CellRange | null {
    const parts = ref.trim().toUpperCase().split(':')
    if (parts.length !== 2) return null
    const parseCell = (s: string) => {
        const m = s.match(/^([A-Z]+)(\d+)$/)
        if (!m) return null
        let col = 0
        for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
        return { row: parseInt(m[2], 10) - 1, col: col - 1, sheetId }
    }
    const start = parseCell(parts[0])
    const end = parseCell(parts[1])
    if (!start || !end) return null
    return { start, end }
}

function autoSeries(range: CellRange, sheetId: string): ChartSeries[] {
    const c1 = Math.min(range.start.col, range.end.col)
    const c2 = Math.max(range.start.col, range.end.col)
    const r1 = Math.min(range.start.row, range.end.row)
    const r2 = Math.max(range.start.row, range.end.row)
    const series: ChartSeries[] = []
    for (let c = c1; c <= c2; c++) {
        series.push({
            name: `시리즈 ${c - c1 + 1}`,
            dataRange: {
                start: { row: r1, col: c, sheetId },
                end: { row: r2, col: c, sheetId },
            },
        })
    }
    return series
}

export function ChartInsertDialog({ sheetId, initialRange, onClose }: Props) {
    const [chartType, setChartType] = useState<ChartType>('bar')
    const [title, setTitle] = useState('')
    const [dataRangeStr, setDataRangeStr] = useState(
        initialRange ? rangeToCellRef(initialRange) : '',
    )
    const [categoryRangeStr, setCategoryRangeStr] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleCreate = () => {
        setError(null)
        const dataRange = parseRangeRef(dataRangeStr, sheetId)
        if (!dataRange) { setError('데이터 범위가 올바르지 않습니다. (예: A1:B5)'); return }

        const categoryRange = categoryRangeStr.trim()
            ? parseRangeRef(categoryRangeStr, sheetId) ?? undefined
            : undefined

        const series = autoSeries(dataRange, sheetId)
        const anchorRow = (initialRange?.end.row ?? 0) + 2
        const anchorCol = initialRange?.start.col ?? 0

        chartManager.createChart({
            sheetId,
            type: chartType,
            title: title.trim() || undefined,
            anchorRow,
            anchorCol,
            widthCols: 8,
            heightRows: 15,
            categoryRange,
            series,
            legendPosition: 'bottom',
        })

        onClose()
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}
            onMouseDown={onClose}
        >
            <div
                style={{
                    background: '#fff', borderRadius: 6, padding: 24, minWidth: 360,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif',
                    fontSize: 13,
                }}
                onMouseDown={e => e.stopPropagation()}
            >
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>차트 삽입</h3>

                {/* 차트 종류 선택 */}
                <label style={labelSt}>차트 종류</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {CHART_TYPES.map(ct => (
                        <button
                            key={ct.type}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 4, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                                border: chartType === ct.type ? '2px solid #1a73e8' : '1px solid #dadce0',
                                background: chartType === ct.type ? '#e8f0fe' : '#fff',
                                color: chartType === ct.type ? '#1a73e8' : '#3c4043',
                                fontSize: 11, fontWeight: 500, minWidth: 70,
                            }}
                            onClick={() => setChartType(ct.type)}
                        >
                            <span style={{ fontSize: 20 }}>{ct.icon}</span>
                            {ct.label}
                        </button>
                    ))}
                </div>

                <label style={labelSt}>데이터 범위</label>
                <input
                    style={inputSt}
                    placeholder="예: A1:C10"
                    value={dataRangeStr}
                    onChange={e => setDataRangeStr(e.target.value)}
                />

                <label style={labelSt}>범주(X축) 범위 (선택)</label>
                <input
                    style={inputSt}
                    placeholder="예: A1:A10"
                    value={categoryRangeStr}
                    onChange={e => setCategoryRangeStr(e.target.value)}
                />

                <label style={labelSt}>차트 제목 (선택)</label>
                <input
                    style={inputSt}
                    placeholder="차트 제목"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />

                {error && <div style={{ color: '#c0392b', marginBottom: 8 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button style={btnSt('#f1f3f4', '#202124')} onClick={onClose}>취소</button>
                    <button style={btnSt('#1a73e8', '#fff')} onClick={handleCreate}>확인</button>
                </div>
            </div>
        </div>
    )
}

const labelSt: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontWeight: 500, color: '#5f6368',
}

const inputSt: React.CSSProperties = {
    display: 'block', width: '100%', marginBottom: 12,
    border: '1px solid #dadce0', borderRadius: 4, padding: '6px 8px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

function btnSt(bg: string, color: string): React.CSSProperties {
    return {
        padding: '6px 16px', borderRadius: 4, border: 'none', background: bg,
        color, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    }
}
