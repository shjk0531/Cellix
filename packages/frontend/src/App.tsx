import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage, ProblemListPage, ProblemPage, ProfilePage } from './pages'
import { useAuthStore } from './store'
import { ThemeProvider } from './components/providers'
import { GlobalLayout } from './components/layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore()
    if (isLoading) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-page)',
            }}>
                로딩 중...
            </div>
        )
    }
    return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
    const { checkAuth } = useAuthStore()

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    return (
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    {/* 인증 불필요 */}
                    <Route path="/login" element={<AuthPage />} />

                    {/* GlobalLayout (sidebar + header) 적용 라우트 */}
                    <Route
                        path="/"
                        element={
                            <PrivateRoute>
                                <GlobalLayout />
                            </PrivateRoute>
                        }
                    >
                        <Route index element={<ProblemListPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                    </Route>

                    {/* 전체화면 스프레드시트 — 자체 레이아웃 */}
                    <Route
                        path="/problems/:id"
                        element={
                            <PrivateRoute>
                                <ProblemPage />
                            </PrivateRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    )
}
