import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@entities/auth/model'
import { NavigationBar } from './NavigationBar'
import './GlobalLayout.css'

function LoadingScreen() {
    return (
        <div className="gl-loading">
            로딩 중...
        </div>
    )
}

export function GlobalLayout() {
    const { user, isLoading } = useAuthStore()

    if (isLoading) return <LoadingScreen />
    if (!user) return <Navigate to="/login" replace />

    return (
        <div className="gl">
            <NavigationBar user={user} />
            <main className="gl-main">
                <Outlet />
            </main>
        </div>
    )
}
