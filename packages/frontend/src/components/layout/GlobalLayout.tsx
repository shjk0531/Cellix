import React, { useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { useThemeStore } from '../../store'
import './GlobalLayout.css'

// ── Route → title mapping ─────────────────────────────────────────────────────

const ROUTE_TITLES: Record<string, string> = {
    '/': '문제 목록',
    '/profile': '내 정보',
}

const NAV_ITEMS = [
    { to: '/', label: '문제 목록', icon: '☰', exact: true },
    { to: '/profile', label: '내 정보', icon: '◎', exact: false },
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

function ThemeToggleButton({ collapsed }: { collapsed: boolean }) {
    const { mode, setMode } = useThemeStore()
    const isDark = mode === 'dark'

    const toggle = () => setMode(isDark ? 'light' : mode === 'light' ? 'system' : 'dark')

    const modeIcon = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '⚙️'
    const modeLabel = mode === 'dark' ? '다크' : mode === 'light' ? '라이트' : '시스템'

    return (
        <button
            title={`테마: ${modeLabel}`}
            onClick={toggle}
            style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                width: '100%',
                padding: collapsed ? '10px' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                border: 'none',
                borderRadius: 'var(--radius-xl)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-md)',
                transition: 'background var(--duration-fast)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{modeIcon}</span>
            <span className="gl-theme-label" style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {modeLabel} 모드
            </span>
        </button>
    )
}

// ── GlobalLayout ──────────────────────────────────────────────────────────────

export function GlobalLayout() {
    const { user, isLoading, logout } = useAuthStore()
    const location = useLocation()
    const navigate = useNavigate()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    if (isLoading) return <LoadingScreen />
    if (!user) return <Navigate to="/login" replace />

    const pageTitle = ROUTE_TITLES[location.pathname] ?? 'Cellix'

    const handleLogout = () => {
        logout().then(() => navigate('/login'))
    }

    const sidebarBg: React.CSSProperties = {
        background: 'var(--color-bg-base)',
        borderRight: '1px solid var(--color-border-default)',
        height: '100%',
    }

    return (
        <div
            className="gl"
            data-collapsed={collapsed}
            data-mobile-open={mobileOpen}
            style={{ background: 'var(--color-bg-page)' }}
        >
            {/* ── Mobile backdrop ───────────────────────────────────────── */}
            {mobileOpen && (
                <div
                    className="gl-mobile-backdrop"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ══ Sidebar ══════════════════════════════════════════════ */}
            <aside className="gl-sidebar" style={sidebarBg}>

                {/* Logo + toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: collapsed ? '16px 10px' : '16px 16px',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    flexShrink: 0,
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        overflow: 'hidden',
                    }}>
                        <span style={{
                            fontSize: 20, flexShrink: 0,
                            color: 'var(--color-accent)',
                        }}>⬡</span>
                        <span
                            className="gl-logo-text"
                            style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 'var(--font-weight-bold)',
                                color: 'var(--color-text-primary)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Cellix
                        </span>
                    </div>
                    <button
                        title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        onClick={() => setCollapsed(c => !c)}
                        style={{
                            flexShrink: 0,
                            width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary)',
                            fontSize: 14,
                            transition: 'background var(--duration-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        {collapsed ? '▶' : '◀'}
                    </button>
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
                    {NAV_ITEMS.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.exact}
                            className={({ isActive }) => `gl-nav-item${isActive ? ' active' : ''}`}
                            title={item.label}
                            onClick={() => setMobileOpen(false)}
                            style={({ isActive }) => ({
                                color: isActive
                                    ? 'var(--color-accent)'
                                    : 'var(--color-text-secondary)',
                                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
                                fontSize: 'var(--font-size-base)',
                            })}
                        >
                            <span
                                className="gl-nav-icon"
                                style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}
                            >
                                {item.icon}
                            </span>
                            <span className="gl-nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Sidebar footer */}
                <div style={{
                    borderTop: '1px solid var(--color-border-subtle)',
                    padding: '8px 8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}>
                    <ThemeToggleButton collapsed={collapsed} />

                    {/* User info */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: collapsed ? '10px' : '10px 12px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        borderRadius: 'var(--radius-xl)',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            width: 28, height: 28, flexShrink: 0,
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-accent-subtle)',
                            color: 'var(--color-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 'var(--font-weight-bold)',
                        }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="gl-user-meta" style={{ overflow: 'hidden', flex: 1 }}>
                            <div style={{
                                fontSize: 'var(--font-size-md)',
                                fontWeight: 'var(--font-weight-semibold)',
                                color: 'var(--color-text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {user.name}
                            </div>
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-text-tertiary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {user.email}
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        title="로그아웃"
                        onClick={handleLogout}
                        style={{
                            display: 'flex', alignItems: 'center',
                            gap: collapsed ? 0 : 10,
                            width: '100%',
                            padding: collapsed ? '10px' : '10px 12px',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            border: 'none',
                            borderRadius: 'var(--radius-xl)',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--color-error)',
                            fontSize: 'var(--font-size-md)',
                            transition: 'background var(--duration-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-error-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>→</span>
                        <span className="gl-nav-label">로그아웃</span>
                    </button>
                </div>
            </aside>

            {/* ══ Header ═══════════════════════════════════════════════ */}
            <header className="gl-header" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 24px',
                background: 'var(--color-bg-base)',
                borderBottom: '1px solid var(--color-border-default)',
                boxShadow: 'var(--shadow-sm)',
            }}>
                {/* Mobile hamburger */}
                <button
                    onClick={() => setMobileOpen(o => !o)}
                    style={{
                        display: 'none',
                        width: 32, height: 32,
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--color-text-secondary)',
                        fontSize: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                    className="gl-hamburger"
                    title="메뉴"
                >
                    ☰
                </button>

                {/* Page title */}
                <h1 style={{
                    margin: 0,
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                    flex: 1,
                }}>
                    {pageTitle}
                </h1>

                {/* User badge */}
                {user.role === 'admin' && (
                    <span style={{
                        padding: '2px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-semibold)',
                        background: 'var(--color-accent-subtle)',
                        color: 'var(--color-accent)',
                    }}>
                        관리자
                    </span>
                )}
                <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <div style={{
                        width: 24, height: 24,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-accent-subtle)',
                        color: 'var(--color-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 'var(--font-weight-bold)',
                        flexShrink: 0,
                    }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    {user.name}
                </span>
            </header>

            {/* ══ Main ═════════════════════════════════════════════════ */}
            <main className="gl-main">
                <Outlet />
            </main>
        </div>
    )
}
