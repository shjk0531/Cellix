import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { GradingResult } from '../api/types'

interface ResultModalProps {
    result: GradingResult
    onClose: () => void
    onRetry: () => void
}

export function ResultModal({ result, onClose, onRetry }: ResultModalProps) {
    const navigate = useNavigate()

    const { percentage, totalScore, maxScore, status, cellResults, tableResults, feedback } = result

    const radius = 54
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - Math.min(percentage, 100) / 100)

    const statusConfig = {
        pass: { label: '통과', color: '#0f9d58', bg: '#e6f4ea' },
        partial: { label: '부분 통과', color: '#f4b400', bg: '#fef9e7' },
        fail: { label: '실패', color: '#db4437', bg: '#fce8e6' },
    }
    const sc = statusConfig[status]

    const allResults = [
        ...cellResults.map(r => ({ key: r.address, label: r.address, passed: r.passed, hint: r.hint, detail: r.expectedValue !== undefined ? `예상: ${r.expectedValue} / 실제: ${r.actualValue ?? '(빈 셀)'}` : undefined })),
        ...tableResults.map(r => ({ key: `table:${r.name}`, label: `표 "${r.name}"`, passed: r.passed, hint: r.hint, detail: undefined })),
    ]

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 16, width: 480, maxHeight: '80vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>

                {/* 헤더 */}
                <div style={{ padding: '28px 28px 20px', textAlign: 'center', borderBottom: '1px solid #f1f3f4' }}>
                    <svg width={128} height={128} style={{ display: 'block', margin: '0 auto 16px' }}>
                        <circle cx={64} cy={64} r={radius} fill="none" stroke="#f1f3f4" strokeWidth={10} />
                        <circle
                            cx={64} cy={64} r={radius} fill="none"
                            stroke={sc.color} strokeWidth={10}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            transform="rotate(-90 64 64)"
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                        <text x={64} y={68} textAnchor="middle" fontSize={22} fontWeight={700} fill="#202124">
                            {Math.round(percentage)}%
                        </text>
                    </svg>

                    <div style={{ fontSize: 20, fontWeight: 700, color: '#202124', marginBottom: 6 }}>
                        {totalScore} / {maxScore}점
                    </div>
                    <span style={{
                        display: 'inline-block', padding: '4px 12px', borderRadius: 12,
                        fontSize: 13, fontWeight: 600, color: sc.color, background: sc.bg,
                    }}>
                        {sc.label}
                    </span>
                </div>

                {/* 피드백 */}
                <div style={{ padding: '16px 28px 8px', fontSize: 14, color: '#5f6368' }}>
                    {feedback}
                </div>

                {/* 결과 목록 */}
                {allResults.length > 0 && (
                    <div style={{ padding: '0 28px 16px', overflowY: 'auto', flex: 1 }}>
                        {allResults.map(r => (
                            <div key={r.key} style={{
                                display: 'flex', flexDirection: 'column', gap: 2,
                                padding: '8px 0', borderBottom: '1px solid #f1f3f4',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>{r.passed ? '✅' : '❌'}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#202124' }}>{r.label}</span>
                                    {r.detail && (
                                        <span style={{ fontSize: 12, color: '#5f6368', marginLeft: 'auto' }}>{r.detail}</span>
                                    )}
                                </div>
                                {!r.passed && r.hint && (
                                    <div style={{ fontSize: 12, color: '#5f6368', paddingLeft: 24 }}>
                                        💡 {r.hint}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 버튼 */}
                <div style={{ padding: '16px 28px', display: 'flex', gap: 10, borderTop: '1px solid #f1f3f4' }}>
                    <button
                        onClick={onRetry}
                        style={{
                            flex: 1, padding: '10px 0', background: '#fff',
                            border: '1px solid #dadce0', borderRadius: 8,
                            fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#202124',
                        }}
                    >
                        다시 풀기
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            flex: 1, padding: '10px 0', background: '#1a73e8',
                            border: 'none', borderRadius: 8,
                            fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
                        }}
                    >
                        문제 목록으로
                    </button>
                </div>
            </div>
        </div>
    )
}
