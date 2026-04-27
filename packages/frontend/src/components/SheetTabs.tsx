import React, { useState, useRef } from 'react'
import { useWorkbookStore } from '../store/useWorkbookStore'

const TAB_BASE: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 12px',
    height: 30,
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    border: 'none',
    borderRight: '1px solid #dadce0',
    background: '#f8f9fa',
    color: '#3c4043',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    position: 'relative',
    gap: 6,
}

const TAB_ACTIVE: React.CSSProperties = {
    ...TAB_BASE,
    background: '#ffffff',
    color: '#1a73e8',
    fontWeight: 600,
    borderTop: '2px solid #1a73e8',
}

/**
 * 하단 시트 탭.
 *
 * - 탭 클릭: 시트 전환
 * - 더블클릭: 인라인 이름 변경
 * - × 클릭: 시트 삭제 (1개 이상일 때)
 * - + 버튼: 시트 추가
 */
export const SheetTabs = React.memo(function SheetTabs() {
    const { sheets, activeSheetId, addSheet, deleteSheet, renameSheet, setActiveSheet } =
        useWorkbookStore()

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const startRename = (id: string, currentName: string) => {
        setEditingId(id)
        setEditingName(currentName)
        setTimeout(() => {
            inputRef.current?.select()
        }, 0)
    }

    const commitRename = () => {
        if (editingId && editingName.trim()) {
            renameSheet(editingId, editingName.trim())
        }
        setEditingId(null)
    }

    const onInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitRename()
        if (e.key === 'Escape') setEditingId(null)
        e.stopPropagation() // InputManager에 전달하지 않음
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'stretch',
                height: 30,
                background: '#f8f9fa',
                borderTop: '1px solid #dadce0',
                overflowX: 'auto',
                overflowY: 'hidden',
                flexShrink: 0,
            }}
        >
            {sheets.map((sheet) => {
                const isActive = sheet.id === activeSheetId
                const isEditing = sheet.id === editingId

                return (
                    <div
                        key={sheet.id}
                        style={isActive ? TAB_ACTIVE : TAB_BASE}
                        onClick={() => setActiveSheet(sheet.id)}
                        onDoubleClick={() => startRename(sheet.id, sheet.name)}
                    >
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={onInputKeyDown}
                                style={{
                                    width: Math.max(60, editingName.length * 8),
                                    border: '1px solid #1a73e8',
                                    borderRadius: 2,
                                    padding: '1px 4px',
                                    fontSize: 12,
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                }}
                                autoFocus
                            />
                        ) : (
                            <span>{sheet.name}</span>
                        )}

                        {/* 삭제 버튼 — 마지막 탭은 비활성 */}
                        {sheets.length > 1 && !isEditing && (
                            <span
                                title="시트 삭제"
                                style={{
                                    fontSize: 11,
                                    color: '#5f6368',
                                    lineHeight: 1,
                                    padding: '0 1px',
                                    borderRadius: 2,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    deleteSheet(sheet.id)
                                }}
                                onMouseEnter={(e) => {
                                    ;(e.currentTarget as HTMLElement).style.background = '#dadce0'
                                    ;(e.currentTarget as HTMLElement).style.color = '#e53935'
                                }}
                                onMouseLeave={(e) => {
                                    ;(e.currentTarget as HTMLElement).style.background = ''
                                    ;(e.currentTarget as HTMLElement).style.color = ''
                                }}
                            >
                                ×
                            </span>
                        )}
                    </div>
                )
            })}

            {/* 시트 추가 버튼 */}
            <button
                title="시트 추가"
                onClick={addSheet}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: '#5f6368',
                    flexShrink: 0,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#e8eaed')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
            >
                +
            </button>
        </div>
    )
})
