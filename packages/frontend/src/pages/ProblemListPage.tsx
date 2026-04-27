import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import type { ProblemSummary } from '../api/types'
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

    const { user, logout } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        apiClient.get<{ problems: ProblemSummary[]; total: number }>('/api/problems?limit=50')
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
        <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
            {/* 헤더 */}
            <div style={{
                background: '#fff',
                borderBottom: '1px solid #dadce0',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                height: 56,
                gap: 16,
            }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#202124' }}>Cellix</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 14, color: '#5f6368' }}>{user?.name}</span>
                <button
                    onClick={() => navigate('/profile')}
                    style={navBtnStyle}
                >내 정보</button>
                <button
                    onClick={() => logout().then(() => navigate('/login'))}
                    style={navBtnStyle}
                >로그아웃</button>
            </div>

            <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 24px' }}>
                <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: '#202124' }}>
                    문제 목록
                </h2>

                {/* 필터 + 검색 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                    {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
                        <button
                            key={d}
                            onClick={() => setFilter(d)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 20,
                                border: '1px solid',
                                borderColor: filter === d ? '#1a73e8' : '#dadce0',
                                background: filter === d ? '#e8f0fe' : '#fff',
                                color: filter === d ? '#1a73e8' : '#5f6368',
                                fontSize: 13,
                                cursor: 'pointer',
                                fontWeight: filter === d ? 600 : 400,
                            }}
                        >
                            {d === 'all' ? '전체' : DIFFICULTY_LABEL[d]}
                        </button>
                    ))}
                    <input
                        style={{
                            marginLeft: 'auto',
                            padding: '7px 12px',
                            border: '1px solid #dadce0',
                            borderRadius: 6,
                            fontSize: 13,
                            outline: 'none',
                            width: 200,
                        }}
                        placeholder="제목 검색..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {loading && <div style={{ textAlign: 'center', color: '#5f6368', padding: 48 }}>로딩 중...</div>}
                {error && <div style={{ color: '#c5221f', padding: 16 }}>{error}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(p => (
                        <div
                            key={p.id}
                            onClick={() => navigate(`/problems/${p.id}`)}
                            style={{
                                background: '#fff',
                                border: '1px solid #dadce0',
                                borderRadius: 10,
                                padding: '16px 20px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                transition: 'box-shadow 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: '#202124' }}>{p.title}</span>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 10,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: DIFFICULTY_COLOR[p.difficulty],
                                        background: `${DIFFICULTY_COLOR[p.difficulty]}18`,
                                    }}>
                                        {DIFFICULTY_LABEL[p.difficulty]}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: '#5f6368', lineHeight: 1.4 }}>
                                    {p.description.slice(0, 80)}{p.description.length > 80 ? '...' : ''}
                                </div>
                                {p.tags.length > 0 && (
                                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {p.tags.map(t => (
                                            <span key={t} style={{
                                                padding: '2px 6px',
                                                background: '#f1f3f4',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                color: '#5f6368',
                                            }}>{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 80 }}>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a73e8' }}>{p.score}점</div>
                                {p.timeLimit && (
                                    <div style={{ fontSize: 12, color: '#5f6368', marginTop: 2 }}>
                                        {Math.floor(p.timeLimit / 60)}분
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {!loading && filtered.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#5f6368', padding: 48 }}>
                            조건에 맞는 문제가 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const navBtnStyle: React.CSSProperties = {
    padding: '6px 14px',
    background: 'none',
    border: '1px solid #dadce0',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    color: '#5f6368',
}
