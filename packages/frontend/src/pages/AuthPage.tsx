import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

export function AuthPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { login, register } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            if (mode === 'login') {
                await login(email, password)
            } else {
                await register(email, password, name)
            }
            navigate('/')
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #dadce0',
        borderRadius: 6,
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
    }

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: 13,
        color: '#5f6368',
        marginBottom: 4,
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8f9fa',
        }}>
            <div style={{
                width: 400,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                padding: 40,
            }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#202124' }}>
                    Cellix
                </h1>
                <p style={{ margin: '0 0 28px', fontSize: 14, color: '#5f6368' }}>
                    {mode === 'login' ? '스프레드시트 교육 플랫폼' : '계정 만들기'}
                </p>

                <form onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>이름</label>
                            <input
                                style={inputStyle}
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="홍길동"
                                required
                            />
                        </div>
                    )}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>이메일</label>
                        <input
                            style={inputStyle}
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="example@email.com"
                            required
                        />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={labelStyle}>비밀번호</label>
                        <input
                            style={inputStyle}
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </div>

                    {error && (
                        <div style={{
                            marginBottom: 16,
                            padding: '8px 12px',
                            background: '#fce8e6',
                            borderRadius: 6,
                            color: '#c5221f',
                            fontSize: 13,
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '11px 0',
                            background: loading ? '#a8c7fa' : '#1a73e8',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '가입하기')}
                    </button>
                </form>

                <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#5f6368' }}>
                    {mode === 'login' ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
                    <button
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#1a73e8',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        {mode === 'login' ? '회원가입' : '로그인'}
                    </button>
                </p>
            </div>
        </div>
    )
}
