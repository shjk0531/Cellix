import React, { useState } from 'react'
import { scenarioManager } from '../../core/analysis'
import type { Scenario } from '../../core/analysis'
import type { CellData } from '@cellix/shared'

interface Props {
    sheetId: string
    setCell: (row: number, col: number, data: CellData) => void
    getCell: (row: number, col: number) => CellData | null
    onClose: () => void
}

function parseCellRef(ref: string): { row: number; col: number } | null {
    const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/)
    if (!m) return null
    let col = 0
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
    return { row: parseInt(m[2], 10) - 1, col: col - 1 }
}


type DialogMode = 'list' | 'add'

export function ScenarioDialog({ sheetId, setCell, getCell, onClose }: Props) {
    const [mode, setMode] = useState<DialogMode>('list')
    const [scenarios, setScenarios] = useState<Scenario[]>(() =>
        scenarioManager.getScenariosForSheet(sheetId)
    )

    // Add form state
    const [newName, setNewName] = useState('')
    const [cellRefs, setCellRefs] = useState<string[]>([''])
    const [cellValues, setCellValues] = useState<string[]>([''])
    const [comment, setComment] = useState('')
    const [formError, setFormError] = useState<string | null>(null)

    const refresh = () => setScenarios(scenarioManager.getScenariosForSheet(sheetId))

    const handleShow = (id: string) => {
        scenarioManager.showScenario(sheetId, id, setCell)
        onClose()
    }

    const handleDelete = (id: string) => {
        scenarioManager.deleteScenario(sheetId, id)
        refresh()
    }

    const handleAdd = () => {
        setFormError(null)
        if (!newName.trim()) { setFormError('시나리오 이름을 입력하세요.'); return }

        const changingCells: Scenario['changingCells'] = []
        for (let i = 0; i < cellRefs.length; i++) {
            const ref = cellRefs[i]
            const val = cellValues[i]
            if (!ref.trim()) continue
            const parsed = parseCellRef(ref)
            if (!parsed) { setFormError(`셀 주소 "${ref}" 가 올바르지 않습니다.`); return }
            const numVal = Number(val)
            changingCells.push({
                row: parsed.row,
                col: parsed.col,
                sheetId,
                value: val === '' ? null : isNaN(numVal) ? val : numVal,
            })
        }

        if (changingCells.length === 0) { setFormError('변경 셀을 하나 이상 입력하세요.'); return }

        scenarioManager.addScenario(sheetId, { name: newName.trim(), changingCells, comment: comment || undefined })
        refresh()
        setMode('list')
        setNewName(''); setCellRefs(['']); setCellValues(['']); setComment('')
    }

    const handleSummary = () => {
        const summaryId = `summary_${sheetId}_${Date.now()}`
        scenarioManager.generateSummary(
            sheetId,
            [],
            (targetSheetId, row, col, data) => {
                if (targetSheetId === summaryId) setCell(row, col, data)
            },
            summaryId,
            getCell,
        )
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
                    background: '#fff', borderRadius: 6, padding: 24, minWidth: 380,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif',
                    fontSize: 13,
                }}
                onMouseDown={e => e.stopPropagation()}
            >
                {mode === 'list' ? (
                    <>
                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>시나리오 관리자</h3>

                        {scenarios.length === 0
                            ? <p style={{ color: '#5f6368', marginBottom: 12 }}>시나리오가 없습니다.</p>
                            : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                                    {scenarios.map(s => (
                                        <li key={s.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '6px 0', borderBottom: '1px solid #f1f3f4',
                                        }}>
                                            <span style={{ flex: 1 }}>{s.name}</span>
                                            <button style={smallBtn('#1a73e8', '#fff')} onClick={() => handleShow(s.id)}>표시</button>
                                            <button style={smallBtn('#ea4335', '#fff')} onClick={() => handleDelete(s.id)}>삭제</button>
                                        </li>
                                    ))}
                                </ul>
                            )
                        }

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                            <button style={btnStyle('#1a73e8', '#fff')} onClick={() => setMode('add')}>+ 추가</button>
                            <button style={btnStyle('#f1f3f4', '#202124')} onClick={handleSummary}>요약 보고서</button>
                            <button style={{ ...btnStyle('#f1f3f4', '#202124'), marginLeft: 'auto' }} onClick={onClose}>닫기</button>
                        </div>
                    </>
                ) : (
                    <>
                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>시나리오 추가</h3>

                        <label style={labelStyle}>시나리오 이름</label>
                        <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} />

                        <label style={labelStyle}>변경 셀</label>
                        {cellRefs.map((ref, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                <input
                                    style={{ ...inputStyle, marginBottom: 0, width: 90 }}
                                    placeholder={`A${i + 1}`}
                                    value={ref}
                                    onChange={e => {
                                        const arr = [...cellRefs]; arr[i] = e.target.value; setCellRefs(arr)
                                        const cell = parseCellRef(e.target.value)
                                        if (cell) {
                                            const existing = getCell(cell.row, cell.col)
                                            const vals = [...cellValues]
                                            vals[i] = existing?.value != null ? String(existing.value) : ''
                                            setCellValues(vals)
                                        }
                                    }}
                                />
                                <input
                                    style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                                    placeholder="값"
                                    value={cellValues[i]}
                                    onChange={e => { const arr = [...cellValues]; arr[i] = e.target.value; setCellValues(arr) }}
                                />
                                {i > 0 && (
                                    <button
                                        style={{ ...smallBtn('#ea4335', '#fff'), padding: '4px 8px' }}
                                        onClick={() => {
                                            setCellRefs(cellRefs.filter((_, idx) => idx !== i))
                                            setCellValues(cellValues.filter((_, idx) => idx !== i))
                                        }}
                                    >✕</button>
                                )}
                            </div>
                        ))}
                        <button
                            style={{ ...smallBtn('#5f6368', '#fff'), marginBottom: 12 }}
                            onClick={() => { setCellRefs([...cellRefs, '']); setCellValues([...cellValues, '']) }}
                        >+ 셀 추가</button>

                        <label style={labelStyle}>메모 (선택)</label>
                        <input style={inputStyle} value={comment} onChange={e => setComment(e.target.value)} />

                        {formError && <div style={{ color: '#c0392b', marginBottom: 8 }}>{formError}</div>}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button style={btnStyle('#f1f3f4', '#202124')} onClick={() => setMode('list')}>취소</button>
                            <button style={btnStyle('#1a73e8', '#fff')} onClick={handleAdd}>저장</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontWeight: 500, color: '#5f6368',
}

const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginBottom: 12,
    border: '1px solid #dadce0', borderRadius: 4, padding: '6px 8px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

function btnStyle(bg: string, color: string): React.CSSProperties {
    return {
        padding: '6px 16px', borderRadius: 4, border: 'none', background: bg,
        color, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    }
}

function smallBtn(bg: string, color: string): React.CSSProperties {
    return {
        padding: '3px 10px', borderRadius: 4, border: 'none', background: bg,
        color, cursor: 'pointer', fontSize: 12, fontWeight: 500,
    }
}
