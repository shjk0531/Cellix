import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage } from './pages/AuthPage'
import { ProblemListPage } from './pages/ProblemListPage'
import { ProblemPage } from './pages/ProblemPage'
import { ProfilePage } from './pages/ProfilePage'
import { useAuthStore } from './store/useAuthStore'

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore()
    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#5f6368' }}>
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
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<AuthPage />} />
                <Route path="/" element={<PrivateRoute><ProblemListPage /></PrivateRoute>} />
                <Route path="/problems/:id" element={<PrivateRoute><ProblemPage /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
