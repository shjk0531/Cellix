import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'

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

    const { user, logout } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        apiClient.get<Submission[]>('/api/submissions/me')
            .then(data => setSubmissions(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const statusLabel = (s: string) =>
        s === 'graded' ? '채점 완료' : s === 'error' ? '오류' : s

    return (
        <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
            <div style={{
                background: '#fff', borderBottom: '1px solid #dadce0',
                padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: 12,
            }}>
                <button onClick={() => navigate('/')} style={navBtn}>← 문제 목록</button>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#202124' }}>내 정보</span>
                <button onClick={handleLogout} style={navBtn}>로그아웃</button>
            </div>

            <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 24px' }}>
                <div style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #dadce0',
                    padding: 24, marginBottom: 24,
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 8 }}>{user?.name}</div>
                    <div style={{ fontSize: 14, color: '#5f6368' }}>{user?.email}</div>
                    {user?.role === 'admin' && (
                        <span style={{ marginTop: 8, display: 'inline-block', padding: '2px 10px', background: '#e8f0fe', color: '#1a73e8', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                            관리자
                        </span>
                    )}
                </div>

                <div style={{ fontSize: 16, fontWeight: 700, color: '#202124', marginBottom: 12 }}>제출 내역</div>

                {loading && <div style={{ color: '#5f6368', textAlign: 'center', padding: 32 }}>로딩 중...</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {submissions.map(sub => (
                        <div key={sub.id} style={{
                            background: '#fff', border: '1px solid #dadce0',
                            borderRadius: 8, padding: '12px 16px',
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, color: '#5f6368' }}>
                                    {new Date(sub.submittedAt).toLocaleString('ko-KR')}
                                </div>
                                <div style={{ fontSize: 12, color: '#9aa0a6', marginTop: 2 }}>
                                    {statusLabel(sub.status)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a73e8' }}>
                                    {sub.totalScore} / {sub.maxScore}점
                                </div>
                                <div style={{ fontSize: 12, color: '#5f6368' }}>
                                    {parseFloat(sub.percentage).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ))}
                    {!loading && submissions.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#5f6368', padding: 40 }}>
                            아직 제출 내역이 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const navBtn: React.CSSProperties = {
    padding: '6px 12px', background: 'none',
    border: '1px solid #dadce0', borderRadius: 6,
    fontSize: 13, cursor: 'pointer', color: '#5f6368',
}
