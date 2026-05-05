import type { WorkbookData } from "./sheet";

// ── 기본 열거 타입 ────────────────────────────────────────────────────────────

export type ProblemType =
    | "formula"
    | "formatting"
    | "chart"
    | "table"
    | "function"
    | "data"
    | "mixed";

export type DifficultyLevel = "easy" | "medium" | "hard";

// 문제 출처 구분 (official: 관리자 등록, community: 일반 사용자 등록)
export type ProblemSourceType = "official" | "community";

// 문제 카테고리 (practice: 단계별 학습, exam: 실전 시험, skill_check: 스킬 체크)
export type ProblemCategory = "practice" | "exam" | "skill_check";

// 문제 게시 상태
export type ProblemStatus =
    | "draft"
    | "pending_review"
    | "published"
    | "rejected";

// 투표 타입
export type VoteType = "up" | "down";

// 사용자 진행 상태
export type ProgressStatus = "solved" | "attempted" | "skipped";

// ── 채점 규칙 ─────────────────────────────────────────────────────────────────

export interface GradingRule {
    targetCell?: string;
    targetRange?: string;
    expectedValue?: string | number | boolean;
    expectedFormula?: string;
    checkStyle?: boolean;
    scoreWeight: number;
    partialCredit: boolean;
}

// ── 문제 ─────────────────────────────────────────────────────────────────────

export interface ExamProblem {
    id: string;
    title: string;
    description: string;
    type: ProblemType;
    difficulty: DifficultyLevel;
    // 세분화 레벨 1~5 (프로그래머스 Lv 대응)
    level: number;
    score: number;
    timeLimit?: number;
    estimatedMinutes?: number;
    initialWorkbook?: WorkbookData;
    gradingRules: GradingRule[];
    hints?: string[];
    tags?: string[];

    sourceType: ProblemSourceType;
    category: ProblemCategory;
    stepLevel?: number;
    status: ProblemStatus;
    voteUp: number;
    voteDown: number;
    viewCount: number;
    acceptanceRate?: number;
    solveCount: number;
    // admin 반려 사유 (status === "rejected"일 때만 존재)
    reviewNote?: string;
    createdBy?: string;

    createdAt: string;
    updatedAt: string;
}

// 목록 조회 시 사용하는 간략 타입 (answerWorkbook 등 민감 정보 제외)
export interface ExamProblemSummary
    extends Omit<ExamProblem, "initialWorkbook" | "gradingRules"> {
    // 로그인한 사용자의 진행 상태 (API join 시만 존재)
    progressStatus?: ProgressStatus;
    isBookmarked?: boolean;
    myVote?: VoteType | null;
}

// ── 문제 필터 파라미터 ────────────────────────────────────────────────────────

export interface ProblemListFilter {
    sourceType?: ProblemSourceType;
    category?: ProblemCategory;
    difficulty?: DifficultyLevel;
    level?: number;
    type?: ProblemType;
    tags?: string[];
    status?: ProblemStatus;
    myOnly?: boolean;
    bookmarked?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "newest" | "vote" | "view" | "acceptance" | "difficulty";
}

// ── 제출 & 채점 결과 ──────────────────────────────────────────────────────────

export type GradingStatus = "pass" | "partial" | "fail";

export interface RuleResult {
    ruleIndex: number;
    status: GradingStatus;
    earnedScore: number;
    maxScore: number;
    feedback?: string;
}

export interface SubmissionResult {
    submissionId: string;
    problemId: string;
    userId: string;
    submittedAt: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    status: GradingStatus;
    ruleResults: RuleResult[];
    gradedWorkbook?: WorkbookData;
    timeSpentSeconds?: number;
}

// ── 풀이 공유 (다른 사람의 풀이) ─────────────────────────────────────────────

export interface ProblemSolution {
    id: string;
    problemId: string;
    userId: string;
    authorName?: string;
    submissionId: string;
    title: string;
    description?: string;
    voteUp: number;
    viewCount: number;
    myVote?: boolean;
    createdAt: string;
    updatedAt: string;
}

// ── 북마크 ───────────────────────────────────────────────────────────────────

export interface Bookmark {
    id: string;
    userId: string;
    problemId: string;
    createdAt: string;
}

// ── 스킬 체크 ────────────────────────────────────────────────────────────────

export type SkillCheckStatus = "active" | "archived";
export type AttemptStatus = "in_progress" | "completed" | "timed_out";

export interface SkillCheck {
    id: string;
    title: string;
    description: string;
    level: number;
    timeLimitMinutes: number;
    status: SkillCheckStatus;
    createdAt: string;
    updatedAt: string;
}

export interface SkillCheckAttempt {
    id: string;
    skillCheckId: string;
    userId: string;
    attemptStatus: AttemptStatus;
    totalScore?: number;
    maxScore?: number;
    certifiedLevel?: number;
    startedAt: string;
    completedAt?: string;
}

// ── 뱃지 ─────────────────────────────────────────────────────────────────────

export type BadgeType = "solve" | "streak" | "level" | "community" | "special";

export interface Badge {
    id: string;
    name: string;
    description: string;
    iconUrl?: string;
    badgeType: BadgeType;
    condition: Record<string, unknown>;
    createdAt: string;
}

export interface UserBadge {
    id: string;
    userId: string;
    badgeId: string;
    badge?: Badge;
    earnedAt: string;
}

// ── 기업 테스트 ───────────────────────────────────────────────────────────────

export type TestSetStatus = "draft" | "active" | "closed";
export type ParticipantStatus = "invited" | "joined" | "completed";

export interface Company {
    id: string;
    userId: string;
    companyName: string;
    logoUrl?: string;
    description?: string;
    websiteUrl?: string;
    employeeRange?: "1-50" | "51-200" | "201-1000" | "1001+";
    industry?: string;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CompanyTestSet {
    id: string;
    companyId: string;
    companyName?: string;
    title: string;
    description?: string;
    timeLimitMinutes?: number;
    status: TestSetStatus;
    isArchivePublic: boolean;
    startsAt?: string;
    endsAt?: string;
    inviteToken?: string;
    maxParticipants?: number;
    problemIds: string[];
    participantCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface CompanyTestParticipant {
    id: string;
    testSetId: string;
    userId: string;
    userName?: string;
    participantStatus: ParticipantStatus;
    totalScore?: number;
    maxScore?: number;
    startedAt?: string;
    completedAt?: string;
    joinedAt: string;
}
