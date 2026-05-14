import React, { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@entities/auth/model'
import { useThemeStore } from '@entities/theme/model'

interface NavigationUser {
    email: string
    name: string
    role: string
}

interface NavigationBarProps {
    user: NavigationUser
}

interface NavSubItem {
    label: string
    to: string
    badge?: string
}

interface NavItem {
    label: string
    to: string
    end?: boolean
    subItems?: NavSubItem[]
}

const NAV_ITEMS: NavItem[] = [
    {
        label: '강의',
        to: '/#courses',
        subItems: [
            { label: '강의 홈', to: '/#courses' },
            { label: '기초 강의', to: '/#courses' },
            { label: '실전 스프레드시트', to: '/#courses', badge: '신규' },
        ],
    },
    {
        label: '문제',
        to: '/#problems',
        end: true,
        subItems: [
            { label: '문제 홈', to: '/#problems' },
            { label: '실습 문제', to: '/#problems' },
            { label: '문제 만들기', to: '/problems/create' },
        ],
    },
    {
        label: '수강중인 강의',
        to: '/my-problems',
        subItems: [
            { label: '내 학습 현황', to: '/my-problems' },
            { label: '최근 풀이', to: '/my-problems' },
        ],
    },
    {
        label: '자유게시판',
        to: '/#board',
        subItems: [
            { label: '전체 글', to: '/#board' },
            { label: '질문과 답변', to: '/#board' },
            { label: '학습 팁', to: '/#board' },
        ],
    },
    {
        label: '내 정보',
        to: '/profile',
    },
]

export function NavigationBar({ user }: NavigationBarProps) {
    const [mobileOpen, setMobileOpen] = useState(false)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const { logout } = useAuthStore()
    const { mode, setMode } = useThemeStore()
    const navigate = useNavigate()

    const hoveredItem = hoveredIndex === null ? null : NAV_ITEMS[hoveredIndex]
    const hasSubMenu = Boolean(hoveredItem?.subItems?.length)
    const nextMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'
    const modeLabel = mode === 'dark' ? '다크' : mode === 'light' ? '라이트' : '시스템'

    const handleLogout = () => {
        logout().then(() => navigate('/login'))
        setMobileOpen(false)
    }

    return (
        <header
            className="gl-navbar"
            onMouseLeave={() => setHoveredIndex(null)}
        >
            <div className="grid-container">
                <div className="gl-nav-inner">
                    <div className="gl-nav-left">
                        <Link to="/" className="gl-logo" aria-label="Cellix 홈">
                            <span className="gl-logo-mark">C</span>
                            <span className="gl-logo-text">Cellix</span>
                        </Link>

                        <nav className="gl-nav-links" aria-label="대표 메뉴">
                            {NAV_ITEMS.map((item, index) => (
                                <NavLink
                                    key={item.label}
                                    to={item.to}
                                    end={item.end}
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    className={({ isActive }) =>
                                        `gl-nav-link${isActive ? ' active' : ''}`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>
                    </div>

                    <div className="gl-nav-right">
                        <Link to="/problems/create" className="gl-primary-link">
                            문제 만들기
                        </Link>
                        <button
                            className="gl-icon-btn"
                            title={`테마: ${modeLabel}`}
                            onClick={() => setMode(nextMode)}
                        >
                            {modeLabel}
                        </button>
                        {user.role === 'admin' && (
                            <span className="gl-admin-badge">관리자</span>
                        )}
                        <div className="gl-user-chip">
                            <div className="gl-avatar">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="gl-user-name">{user.name}</span>
                        </div>
                        <button className="gl-logout-btn" onClick={handleLogout}>
                            로그아웃
                        </button>
                    </div>

                    <button
                        className="gl-hamburger"
                        onClick={() => setMobileOpen(open => !open)}
                        aria-expanded={mobileOpen}
                        aria-label="메뉴 열기"
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </div>

            {hasSubMenu && (
                <div className="gl-subnav">
                    <div className="grid-container">
                        <div className="gl-subnav-inner">
                            <strong>{hoveredItem?.label}</strong>
                            <div className="gl-subnav-list">
                                {hoveredItem?.subItems?.map(subItem => (
                                    <Link
                                        key={`${hoveredItem.label}-${subItem.label}`}
                                        to={subItem.to}
                                        className="gl-subnav-link"
                                    >
                                        {subItem.label}
                                        {subItem.badge && (
                                            <span className="gl-subnav-badge">
                                                {subItem.badge}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {mobileOpen && (
                <div className="gl-mobile-menu">
                    <div className="grid-container">
                        <nav className="gl-mobile-nav" aria-label="모바일 메뉴">
                            {NAV_ITEMS.map(item => (
                                <div key={item.label} className="gl-mobile-group">
                                    <Link
                                        to={item.to}
                                        className="gl-mobile-nav-link"
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        {item.label}
                                    </Link>
                                    {(item.subItems?.length ?? 0) > 0 && (
                                        <div className="gl-mobile-subnav">
                                            {item.subItems?.map(subItem => (
                                                <Link
                                                    key={`${item.label}-${subItem.label}`}
                                                    to={subItem.to}
                                                    onClick={() => setMobileOpen(false)}
                                                >
                                                    {subItem.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </nav>
                        <div className="gl-mobile-footer">
                            <div className="gl-mobile-user">
                                <div className="gl-avatar">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="gl-mobile-user-name">{user.name}</div>
                                    <div className="gl-mobile-user-email">{user.email}</div>
                                </div>
                            </div>
                            <button
                                className="gl-mobile-action-btn"
                                onClick={() => {
                                    setMode(nextMode)
                                    setMobileOpen(false)
                                }}
                            >
                                {modeLabel} 테마
                            </button>
                            <button
                                className="gl-mobile-action-btn danger"
                                onClick={handleLogout}
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mobileOpen && (
                <button
                    className="gl-mobile-backdrop"
                    aria-label="메뉴 닫기"
                    onClick={() => setMobileOpen(false)}
                />
            )}
        </header>
    )
}
