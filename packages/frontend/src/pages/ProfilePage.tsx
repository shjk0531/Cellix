import React, { useEffect, useState } from 'react'
import { apiClient } from '../api'
import { useAuthStore } from '../store'

interface Submission {
    id: string
    problemId: string
    totalScore: string
    maxScore: number
    percentage: string
    status: string
    submittedAt: string
}

export function ProfilePage() {
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuthStore()

    useEffect(() => {
        apiClient
            .get<Submission[]>('/api/submissions/me')
            .then(data => setSubmissions(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const statusLabel = (s: string) =>
        s === 'graded' ? '채점 완료' : s === 'error' ? '오류' : s

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
            {/* 프로필 카드 */}
            <div style={{
                background: 'var(--color-bg-base)',
                borderRadius: 'var(--radius-2xl)',
                border: '1px solid var(--color-border-default)',
                padding: 24,
                marginBottom: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
            }}>
                <div style={{
                    width: 56, height: 56,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent-subtle)',
                    color: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 'var(--font-weight-bold)',
                    flexShrink: 0,
                }}>
                    {user?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-text-primary)',
                        marginBottom: 4,
                    }}>
                        {user?.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                        {user?.email}
                    </div>
                    {user?.role === 'admin' && (
                        <span style={{
                            marginTop: 6,
                            display: 'inline-block',
                            padding: '2px 10px',
                            background: 'var(--color-accent-subtle)',
                            color: 'var(--color-accent)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-semibold)',
                        }}>
                            관리자
                        </span>
                    )}
                </div>
            </div>

            {/* 제출 내역 */}
            <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 12,
            }}>
                제출 내역
            </div>

            {loading && (
                <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 32 }}>
                    로딩 중...
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {submissions.map(sub => (
                    <div key={sub.id} style={{
                        background: 'var(--color-bg-base)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)' }}>
                                {new Date(sub.submittedAt).toLocaleString('ko-KR')}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                                {statusLabel(sub.status)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 'var(--font-weight-bold)',
                                color: 'var(--color-accent)',
                            }}>
                                {sub.totalScore} / {sub.maxScore}점
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                {parseFloat(sub.percentage).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                ))}
                {!loading && submissions.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 40 }}>
                        아직 제출 내역이 없습니다.
                    </div>
                )}
            </div>
        </div>
    )
}
