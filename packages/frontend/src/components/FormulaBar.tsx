import React from 'react'
import { useUIStore } from '../store/useUIStore'

function colToLetter(col: number): string {
    let result = ''
    let n = col + 1
    while (n > 0) {
        const rem = (n - 1) % 26
        result = String.fromCharCode(65 + rem) + result
        n = Math.floor((n - 1) / 26)
    }
    return result
}

function toCellAddress(row: number, col: number): string {
    return `${colToLetter(col)}${row + 1}`
}

/**
 * 수식 입력줄.
 *
 * - 왼쪽: 활성 셀 주소 (예: A1, B3) — 선택 없을 때 빈 칸
 * - 오른쪽: 셀 값/수식 표시 (편집 중이면 현재 입력값, 아니면 저장된 값)
 *
 * 수식 입력줄에서 직접 편집하는 기능은 TODO — 현재는 표시 전용.
 */
export function FormulaBar() {
    const { activeCell, editMode, editValue, activeCellData } = useUIStore()

    const address = activeCell ? toCellAddress(activeCell.row, activeCell.col) : ''

    const displayValue =
        editMode !== 'none'
            ? editValue
            : (activeCellData?.formula ?? String(activeCellData?.value ?? ''))

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                height: 28,
                background: '#ffffff',
                borderBottom: '1px solid #dadce0',
                flexShrink: 0,
            }}
        >
            {/* 셀 주소 박스 */}
            <div
                style={{
                    width: 72,
                    padding: '0 8px',
                    fontSize: 13,
                    fontFamily: 'system-ui, sans-serif',
                    color: '#1f2329',
                    textAlign: 'center',
                    borderRight: '1px solid #dadce0',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {address}
            </div>

            {/* fx 아이콘 */}
            <div
                style={{
                    padding: '0 8px',
                    fontSize: 13,
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    color: '#5f6368',
                    borderRight: '1px solid #dadce0',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                }}
            >
                fx
            </div>

            {/* 값/수식 표시 */}
            <div
                style={{
                    flex: 1,
                    padding: '0 8px',
                    fontSize: 13,
                    fontFamily: 'system-ui, sans-serif',
                    color: editMode === 'formula' ? '#1a73e8' : '#1f2329',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    cursor: 'default',
                }}
                title={displayValue}
            >
                {displayValue}
            </div>
        </div>
    )
}
