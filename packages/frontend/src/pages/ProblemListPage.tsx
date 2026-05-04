import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient, type ProblemSummary } from '../api'
import type { DifficultyLevel } from '@cellix/shared'

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
    easy: '쉬움',
    medium: '보통',
    hard: '어려움',
}

const DIFFICULTY_COLOR: Record<DifficultyLevel, string> = {
    easy: '#0f9d58',
    medium: '#f4b400',
    hard: '#db4437',
}

export function ProblemListPage() {
    const [problems, setProblems] = useState<ProblemSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<DifficultyLevel | 'all'>('all')
    const [search, setSearch] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        apiClient
            .get<{ problems: ProblemSummary[]; total: number }>('/api/problems?limit=50')
            .then(data => setProblems(data.problems ?? []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    const filtered = problems.filter(p => {
        if (filter !== 'all' && p.difficulty !== filter) return false
        if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    return (
        <div className="grid-container" style={{ paddingTop: 32, paddingBottom: 40 }}>

            {/* 필터 + 검색 */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 20,
                alignItems: 'center',
            }}>
                {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
                    <button
                        key={d}
                        onClick={() => setFilter(d)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid',
                            borderColor: filter === d ? 'var(--color-accent)' : 'var(--color-border-default)',
                            background: filter === d ? 'var(--color-accent-subtle)' : 'var(--color-bg-base)',
                            color: filter === d ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            fontSize: 'var(--font-size-md)',
                            cursor: 'pointer',
                            fontWeight: filter === d ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
                            transition: 'all var(--duration-fast)',
                        }}
                    >
                        {d === 'all' ? '전체' : DIFFICULTY_LABEL[d]}
                    </button>
                ))}
                <input
                    style={{
                        marginLeft: 'auto',
                        padding: '7px 12px',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: 'var(--font-size-md)',
                        outline: 'none',
                        width: 200,
                        maxWidth: '100%',
                        background: 'var(--color-bg-base)',
                        color: 'var(--color-text-primary)',
                    }}
                    placeholder="제목 검색..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 48 }}>
                    로딩 중...
                </div>
            )}
            {error && (
                <div style={{ color: 'var(--color-error)', padding: 16 }}>{error}</div>
            )}

            {/* 문제 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(p => (
                    <div
                        key={p.id}
                        onClick={() => navigate(`/problems/${p.id}`)}
                        style={{
                            background: 'var(--color-bg-base)',
                            border: '1px solid var(--color-border-default)',
                            borderRadius: 'var(--radius-2xl)',
                            padding: '16px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            transition: 'box-shadow var(--duration-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: 'var(--font-size-base)',
                                    fontWeight: 'var(--font-weight-semibold)',
                                    color: 'var(--color-text-primary)',
                                }}>
                                    {p.title}
                                </span>
                                <span style={{
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 'var(--font-weight-semibold)',
                                    color: DIFFICULTY_COLOR[p.difficulty],
                                    background: `${DIFFICULTY_COLOR[p.difficulty]}18`,
                                    flexShrink: 0,
                                }}>
                                    {DIFFICULTY_LABEL[p.difficulty]}
                                </span>
                            </div>
                            <div style={{
                                fontSize: 'var(--font-size-md)',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 'var(--line-height-snug)',
                            }}>
                                {p.description.slice(0, 80)}{p.description.length > 80 ? '...' : ''}
                            </div>
                            {p.tags.length > 0 && (
                                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {p.tags.map(t => (
                                        <span key={t} style={{
                                            padding: '2px 6px',
                                            background: 'var(--color-bg-sunken)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-secondary)',
                                        }}>
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 72, flexShrink: 0 }}>
                            <div style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 'var(--font-weight-bold)',
                                color: 'var(--color-accent)',
                            }}>
                                {p.score}점
                            </div>
                            {p.timeLimit && (
                                <div style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-text-tertiary)',
                                    marginTop: 2,
                                }}>
                                    {Math.floor(p.timeLimit / 60)}분
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {!loading && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 48 }}>
                        조건에 맞는 문제가 없습니다.
                    </div>
                )}
            </div>
        </div>
    )
}
