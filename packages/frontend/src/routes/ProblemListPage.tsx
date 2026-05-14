import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '@shared/api'
import type { ProblemSummary } from '@features/problems/api'
import './ProblemListPage.css'

type IconName = 'course' | 'problem' | 'learning' | 'board'

interface HomeBanner {
    eyebrow: string
    title: string
    description: string
    ctaLabel: string
    ctaTo: string
    imageAlt: string
}

interface HomeCard {
    title: string
    description: string
    meta: string
    tone: 'blue' | 'green' | 'yellow' | 'red'
    to: string
}

const homeBanner: HomeBanner = {
    eyebrow: 'Cellix 클래스',
    title: '스프레드시트 실무를 문제로 배우는 가장 빠른 방법',
    description: '강의, 실습 문제, 채점 워크북을 한 곳에서 이어가며 데이터 업무 감각을 쌓아보세요.',
    ctaLabel: '학습 시작하기',
    ctaTo: '#courses',
    imageAlt: 'Cellix 학습 안내 이미지',
}

const quickMenus: Array<{ label: string; icon: IconName; to: string }> = [
    { label: '강의', icon: 'course', to: '#courses' },
    { label: '문제', icon: 'problem', to: '#problems' },
    { label: '수강중인 강의', icon: 'learning', to: '/my-problems' },
    { label: '자유게시판', icon: 'board', to: '#board' },
]

const courseCards: HomeCard[] = [
    {
        title: '엑셀 기본기 압축 강의',
        description: '셀 참조, 함수, 필터를 실무 흐름으로 익힙니다.',
        meta: '입문 코스',
        tone: 'blue',
        to: '#courses',
    },
    {
        title: '데이터 분석을 위한 함수 실전',
        description: '조건부 집계와 표 기반 분석 패턴을 연습합니다.',
        meta: '중급 코스',
        tone: 'green',
        to: '#courses',
    },
    {
        title: '채점 문제 제작 워크숍',
        description: '템플릿 워크북과 채점 규칙을 직접 설계합니다.',
        meta: '운영자 추천',
        tone: 'yellow',
        to: '/problems/create',
    },
]

const learningCards: HomeCard[] = [
    {
        title: '최근 풀이 이어하기',
        description: '멈춘 지점부터 다시 열고 점수를 개선합니다.',
        meta: '내 학습',
        tone: 'green',
        to: '/my-problems',
    },
    {
        title: '오답 문제 다시 풀기',
        description: '틀린 셀과 수식을 중심으로 복습합니다.',
        meta: '복습',
        tone: 'red',
        to: '/my-problems',
    },
    {
        title: '완료한 문제 모아보기',
        description: '완료 기록과 최고 점수를 한 번에 확인합니다.',
        meta: '리포트',
        tone: 'blue',
        to: '/my-problems',
    },
]

const boardCards: HomeCard[] = [
    {
        title: '함수 질문 게시판',
        description: '막힌 수식과 오류 메시지를 공유합니다.',
        meta: 'Q&A',
        tone: 'blue',
        to: '#board',
    },
    {
        title: '실무 템플릿 공유',
        description: '반복 업무에 바로 쓰는 워크북 구조를 나눕니다.',
        meta: '자료',
        tone: 'green',
        to: '#board',
    },
    {
        title: '자유 토론',
        description: '데이터 업무와 학습 경험을 편하게 이야기합니다.',
        meta: '커뮤니티',
        tone: 'yellow',
        to: '#board',
    },
]

function HomeIcon({ name }: { name: IconName }) {
    const paths: Record<IconName, React.ReactNode> = {
        course: (
            <>
                <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" />
                <path d="M7 9.5v5.2c0 1.1 2.2 2.3 5 2.3s5-1.2 5-2.3V9.5" />
            </>
        ),
        problem: (
            <>
                <rect x="5" y="4" width="14" height="16" rx="2" />
                <path d="M9 8h6M9 12h3M9 16h6" />
            </>
        ),
        learning: (
            <>
                <rect x="4" y="5" width="16" height="12" rx="2" />
                <path d="m9 10 2 2 4-4M8 21h8" />
            </>
        ),
        board: (
            <>
                <path d="M5 5h14v10H8l-3 3V5Z" />
                <path d="M8 9h8M8 12h5" />
            </>
        ),
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {paths[name]}
        </svg>
    )
}

function BannerIllustration() {
    return (
        <div className="home-banner-visual" aria-label={homeBanner.imageAlt}>
            <div className="home-sheet-card">
                <div className="home-sheet-toolbar" />
                <div className="home-sheet-grid">
                    {Array.from({ length: 24 }, (_, index) => (
                        <span key={index} />
                    ))}
                </div>
            </div>
            <div className="home-score-card">
                <strong>94</strong>
                <span>점</span>
            </div>
            <div className="home-formula-card">=SUM(A1:C8)</div>
        </div>
    )
}

function HomeSection({
    id,
    title,
    cards,
}: {
    id: string
    title: string
    cards: HomeCard[]
}) {
    return (
        <section id={id} className="home-section">
            <div className="home-section-header">
                <h2>{title}</h2>
                <Link to={cards[0]?.to ?? '/'}>더 보기</Link>
            </div>
            <div className="grid-row">
                {cards.map(card => (
                    <Link
                        key={card.title}
                        to={card.to}
                        className={`home-card col-4 col-md-3 col-sm-4 home-card-${card.tone}`}
                    >
                        <span className="home-card-meta">{card.meta}</span>
                        <h3>{card.title}</h3>
                        <p>{card.description}</p>
                    </Link>
                ))}
            </div>
        </section>
    )
}

function ProblemCard({ problem }: { problem: ProblemSummary }) {
    const navigate = useNavigate()
    const minutes = problem.estimatedMinutes ?? (
        problem.timeLimit ? Math.ceil(problem.timeLimit / 60) : null
    )

    return (
        <button
            className="home-problem-card col-4 col-md-3 col-sm-4"
            onClick={() => navigate(`/problems/${problem.id}`)}
        >
            <span className="home-card-meta">문제</span>
            <h3>{problem.title}</h3>
            <p>
                {problem.description.length > 76
                    ? `${problem.description.slice(0, 76)}...`
                    : problem.description}
            </p>
            <div className="home-problem-footer">
                <span>{problem.score}점</span>
                {minutes && <span>{minutes}분</span>}
            </div>
        </button>
    )
}

export function ProblemListPage() {
    const [problems, setProblems] = useState<ProblemSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        apiClient
            .get<{ problems: ProblemSummary[]; total: number }>('/api/problems?limit=6')
            .then(data => setProblems(data.problems ?? []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    const fallbackProblems = useMemo<HomeCard[]>(() => [
        {
            title: '매출 합계 자동 계산',
            description: 'SUM과 상대 참조로 월별 매출표를 완성합니다.',
            meta: '기초 문제',
            tone: 'blue',
            to: '#problems',
        },
        {
            title: '조건별 성과 집계',
            description: 'IF와 COUNTIF로 조건에 맞는 셀을 분석합니다.',
            meta: '실전 문제',
            tone: 'green',
            to: '#problems',
        },
        {
            title: '보고서 서식 정리',
            description: '표 스타일과 숫자 형식을 적용해 제출물을 다듬습니다.',
            meta: '서식 문제',
            tone: 'yellow',
            to: '#problems',
        },
    ], [])

    return (
        <div className="home-page">
            <section className="home-banner">
                <div className="grid-container home-banner-inner">
                    <div className="home-banner-copy">
                        <span>{homeBanner.eyebrow}</span>
                        <h1>{homeBanner.title}</h1>
                        <p>{homeBanner.description}</p>
                        <Link to={homeBanner.ctaTo}>{homeBanner.ctaLabel}</Link>
                    </div>
                    <BannerIllustration />
                </div>
            </section>

            <div className="grid-container home-content">
                <nav className="home-quick-menu grid-row" aria-label="주요 바로가기">
                    {quickMenus.map(item => (
                        <Link
                            key={item.label}
                            to={item.to}
                            className="home-quick-item col-3 col-md-3 col-sm-2"
                        >
                            <span>
                                <HomeIcon name={item.icon} />
                            </span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <HomeSection id="courses" title="강의" cards={courseCards} />

                <section id="problems" className="home-section">
                    <div className="home-section-header">
                        <h2>문제</h2>
                        <Link to="/#problems">더 보기</Link>
                    </div>
                    {loading && <div className="home-state">문제를 불러오는 중입니다.</div>}
                    {error && !loading && (
                        <div className="home-state">
                            문제 목록을 불러오지 못해 추천 문제를 표시합니다.
                        </div>
                    )}
                    <div className="grid-row">
                        {!loading && problems.length > 0
                            ? problems.slice(0, 6).map(problem => (
                                <ProblemCard key={problem.id} problem={problem} />
                            ))
                            : fallbackProblems.map(card => (
                                <Link
                                    key={card.title}
                                    to={card.to}
                                    className={`home-card col-4 col-md-3 col-sm-4 home-card-${card.tone}`}
                                >
                                    <span className="home-card-meta">{card.meta}</span>
                                    <h3>{card.title}</h3>
                                    <p>{card.description}</p>
                                </Link>
                            ))}
                    </div>
                </section>

                <HomeSection id="learning" title="수강중인 강의" cards={learningCards} />
                <HomeSection id="board" title="자유게시판" cards={boardCards} />
            </div>
        </div>
    )
}
