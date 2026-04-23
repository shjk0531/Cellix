import React from 'react'
import { useUIStore } from '../store/useUIStore'

const BTN: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 3,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    color: '#3c4043',
    fontFamily: 'system-ui, sans-serif',
    transition: 'background 0.1s',
}

const BTN_ACTIVE: React.CSSProperties = {
    ...BTN,
    background: '#e8f0fe',
    color: '#1a73e8',
}

const SEP: React.CSSProperties = {
    width: 1,
    height: 20,
    background: '#dadce0',
    margin: '0 4px',
}

type BtnProps = {
    label: string
    title: string
    style?: React.CSSProperties
    active?: boolean
    onClick?: () => void
}

function Btn({ label, title, style, active, onClick }: BtnProps) {
    const [hover, setHover] = React.useState(false)
    const base = active ? BTN_ACTIVE : BTN
    return (
        <button
            title={title}
            style={{
                ...base,
                ...(hover && !active ? { background: '#f1f3f4' } : {}),
                ...style,
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

/**
 * 상단 리본 툴바.
 * 서식 버튼(굵게/기울임/밑줄/정렬)은 UI 껍데기만 제공 — 데이터 스토어 연동 후 활성화 예정.
 */
export function Toolbar() {
    const { canUndo, canRedo } = useUIStore()

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                height: 40,
                padding: '0 8px',
                background: '#ffffff',
                borderBottom: '1px solid #dadce0',
                gap: 2,
                flexShrink: 0,
                userSelect: 'none',
            }}
        >
            {/* 실행취소 / 다시실행 */}
            <Btn label="↩" title="실행취소 (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.4 }} />
            <Btn label="↪" title="다시실행 (Ctrl+Y)" style={{ opacity: canRedo ? 1 : 0.4 }} />

            <div style={SEP} />

            {/* 글꼴 서식 */}
            <Btn label="B" title="굵게 (Ctrl+B)" style={{ fontWeight: 700 }} />
            <Btn label="I" title="기울임 (Ctrl+I)" style={{ fontStyle: 'italic' }} />
            <Btn label="U" title="밑줄 (Ctrl+U)" style={{ textDecoration: 'underline' }} />
            <Btn label="S" title="취소선" style={{ textDecoration: 'line-through' }} />

            <div style={SEP} />

            {/* 테두리 / 병합 */}
            <Btn label="⊞" title="테두리" />
            <Btn label="⊡" title="셀 병합" />

            <div style={SEP} />

            {/* 정렬 */}
            <Btn label="≡" title="왼쪽 정렬" />
            <Btn label="≡" title="가운데 정렬" style={{ letterSpacing: 1 }} />
            <Btn label="≡" title="오른쪽 정렬" />

            <div style={SEP} />

            {/* 숫자 서식 */}
            <Btn label="%" title="백분율" />
            <Btn label="," title="천단위 구분" />
            <Btn label=".0" title="소수점 늘리기" />
            <Btn label=".9" title="소수점 줄이기" />
        </div>
    )
}
