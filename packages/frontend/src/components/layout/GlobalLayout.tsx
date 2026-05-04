import React, { useState } from 'react'
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { useThemeStore } from '../../store'
import './GlobalLayout.css'

// ── Navigation items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
    { to: '/', label: '문제 목록', exact: true },
    { to: '/profile', label: '내 정보', exact: false },
] as const

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingScreen() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
            background: 'var(--color-bg-page)',
        }}>
            로딩 중...
        </div>
    )
}

// ── GlobalLayout ──────────────────────────────────────────────────────────────

export function GlobalLayout() {
    const { user, isLoading, logout } = useAuthStore()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const { mode, setMode } = useThemeStore()

    if (isLoading) return <LoadingScreen />
    if (!user) return <Navigate to="/login" replace />

    const modeIcon = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '⚙️'
    const modeLabel = mode === 'dark' ? '다크' : mode === 'light' ? '라이트' : '시스템'
    const nextMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'

    const handleLogout = () => {
        logout().then(() => navigate('/login'))
        setMobileOpen(false)
    }

    const closeMobile = () => setMobileOpen(false)

    return (
        <div className="gl" style={{ background: 'var(--color-bg-page)' }}>

            {/* ══ Navbar ═══════════════════════════════════════════════ */}
            <header className="gl-navbar">
                <div className="grid-container">
                    <div className="gl-nav-inner">

                        {/* Left: Logo + nav links */}
                        <div className="gl-nav-left">
                            <div className="gl-logo">
                                <span style={{ fontSize: 20, color: 'var(--color-accent)', lineHeight: 1 }}>⬡</span>
                                <span style={{
                                    fontSize: 'var(--font-size-lg)',
                                    fontWeight: 'var(--font-weight-bold)',
                                    color: 'var(--color-text-primary)',
                                }}>
                                    Cellix
                                </span>
                            </div>

                            <nav className="gl-nav-links">
                                {NAV_ITEMS.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.exact}
                                        className={({ isActive }) =>
                                            `gl-nav-link${isActive ? ' active' : ''}`
                                        }
                                    >
                                        {item.label}
                                    </NavLink>
                                ))}
                            </nav>
                        </div>

                        {/* Right: theme toggle, user info, logout */}
                        <div className="gl-nav-right">
                            <button
                                className="gl-icon-btn"
                                title={`테마: ${modeLabel}`}
                                onClick={() => setMode(nextMode)}
                            >
                                <span style={{ fontSize: 15 }}>{modeIcon}</span>
                            </button>

                            {user.role === 'admin' && (
                                <span className="gl-admin-badge">관리자</span>
                            )}

                            <div className="gl-user-chip">
                                <div className="gl-avatar">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="gl-user-name">
                                    {user.name}
                                </span>
                            </div>

                            <button
                                className="gl-logout-btn"
                                onClick={handleLogout}
                                title="로그아웃"
                            >
                                <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
                                <span className="gl-logout-label">로그아웃</span>
                            </button>
                        </div>

                        {/* Hamburger — mobile only */}
                        <button
                            className="gl-hamburger"
                            onClick={() => setMobileOpen(o => !o)}
                            title="메뉴"
                            aria-expanded={mobileOpen}
                        >
                            {mobileOpen ? '✕' : '☰'}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown menu */}
                {mobileOpen && (
                    <div className="gl-mobile-menu">
                        <div className="grid-container">
                            <nav className="gl-mobile-nav">
                                {NAV_ITEMS.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.exact}
                                        className={({ isActive }) =>
                                            `gl-mobile-nav-link${isActive ? ' active' : ''}`
                                        }
                                        onClick={closeMobile}
                                    >
                                        {item.label}
                                    </NavLink>
                                ))}
                            </nav>

                            <div className="gl-mobile-footer">
                                <div className="gl-mobile-user">
                                    <div className="gl-avatar">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: 'var(--font-size-md)',
                                            fontWeight: 'var(--font-weight-semibold)',
                                            color: 'var(--color-text-primary)',
                                        }}>
                                            {user.name}
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-tertiary)',
                                        }}>
                                            {user.email}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="gl-mobile-action-btn"
                                    onClick={() => { setMode(nextMode); closeMobile() }}
                                >
                                    <span>{modeIcon}</span>
                                    {modeLabel} 모드
                                </button>
                                <button
                                    className="gl-mobile-action-btn danger"
                                    onClick={handleLogout}
                                >
                                    <span>→</span>
                                    로그아웃
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Backdrop for mobile menu */}
            {mobileOpen && (
                <div className="gl-mobile-backdrop" onClick={closeMobile} />
            )}

            {/* ══ Main ═════════════════════════════════════════════════ */}
            <main className="gl-main">
                <Outlet />
            </main>
        </div>
    )
}
