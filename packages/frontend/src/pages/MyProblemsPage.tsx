import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { problemApi } from "../api/problemApi";
import type { ProblemSummary } from "../api/types";
import type { ProblemStatus } from "@cellix/shared";

// ── 상수 ─────────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: ProblemStatus | "all"; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "draft", label: "임시저장" },
    { value: "pending_review", label: "검토 요청" },
    { value: "published", label: "게시됨" },
    { value: "rejected", label: "반려됨" },
];

const STATUS_BADGE: Record<
    ProblemStatus,
    { label: string; bg: string; color: string }
> = {
    draft: { label: "임시저장", bg: "#f1f3f4", color: "#5f6368" },
    pending_review: { label: "검토 요청", bg: "#fef7e0", color: "#b06000" },
    published: { label: "게시됨", bg: "#e6f4ea", color: "#137333" },
    rejected: { label: "반려됨", bg: "#fce8e6", color: "#c5221f" },
};

const DIFFICULTY_LABEL: Record<string, string> = {
    easy: "쉬움",
    medium: "보통",
    hard: "어려움",
};
const DIFFICULTY_COLOR: Record<string, string> = {
    easy: "#0f9d58",
    medium: "#f4b400",
    hard: "#db4437",
};

const TYPE_LABEL: Record<string, string> = {
    formula: "수식",
    formatting: "서식",
    chart: "차트",
    table: "표/피벗",
    function: "함수",
    data: "정렬/필터",
    mixed: "복합",
};

// ── 삭제 확인 모달 ────────────────────────────────────────────────────────────

function DeleteConfirm({
    title,
    onConfirm,
    onCancel,
    loading,
}: {
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--color-bg-base)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "var(--radius-2xl)",
                    padding: "28px 32px",
                    maxWidth: 400,
                    width: "90%",
                    boxShadow: "var(--shadow-xl)",
                }}
            >
                <div
                    style={{
                        fontSize: "var(--font-size-lg)",
                        fontWeight: "var(--font-weight-semibold)",
                        color: "var(--color-text-primary)",
                        marginBottom: 12,
                    }}
                >
                    문제 삭제
                </div>
                <div
                    style={{
                        fontSize: "var(--font-size-base)",
                        color: "var(--color-text-secondary)",
                        marginBottom: 24,
                        lineHeight: 1.6,
                    }}
                >
                    <strong>"{title}"</strong>을 삭제하시겠습니까?
                    <br />
                    삭제된 문제는 복구할 수 없습니다.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        취소
                    </Button>
                    <Button
                        variant="danger"
                        size="md"
                        loading={loading}
                        onClick={onConfirm}
                    >
                        삭제
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── 문제 카드 ─────────────────────────────────────────────────────────────────

function ProblemCard({
    problem,
    onEdit,
    onSubmitReview,
    onDelete,
    actionLoading,
}: {
    problem: ProblemSummary;
    onEdit: (p: ProblemSummary) => void;
    onSubmitReview: (p: ProblemSummary) => void;
    onDelete: (p: ProblemSummary) => void;
    actionLoading: string | null;
}) {
    const badge = STATUS_BADGE[problem.status];

    return (
        <div
            style={{
                background: "var(--color-bg-base)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-2xl)",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            {/* 상단: 제목 + 뱃지들 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                }}
            >
                <span
                    style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "var(--font-size-base)",
                        fontWeight: "var(--font-weight-semibold)",
                        color: "var(--color-text-primary)",
                        lineHeight: 1.4,
                    }}
                >
                    {problem.title}
                </span>
                {/* 상태 뱃지 */}
                <span
                    style={{
                        padding: "3px 10px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: "var(--font-weight-semibold)",
                        background: badge.bg,
                        color: badge.color,
                        flexShrink: 0,
                    }}
                >
                    {badge.label}
                </span>
            </div>

            {/* 설명 */}
            <div
                style={{
                    fontSize: "var(--font-size-md)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                }}
            >
                {problem.description}
            </div>

            {/* 메타 정보 */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                }}
            >
                <span
                    style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: "var(--font-weight-semibold)",
                        color: DIFFICULTY_COLOR[problem.difficulty] ?? "#666",
                        background: `${DIFFICULTY_COLOR[problem.difficulty] ?? "#666"}18`,
                    }}
                >
                    {DIFFICULTY_LABEL[problem.difficulty] ?? problem.difficulty}
                </span>
                <span
                    style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--font-size-xs)",
                        background: "var(--color-bg-sunken)",
                        color: "var(--color-text-secondary)",
                    }}
                >
                    Lv.{problem.level}
                </span>
                <span
                    style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--font-size-xs)",
                        background: "var(--color-bg-sunken)",
                        color: "var(--color-text-secondary)",
                    }}
                >
                    {TYPE_LABEL[problem.type] ?? problem.type}
                </span>
                {(problem.tags ?? []).slice(0, 3).map((t) => (
                    <span
                        key={t}
                        style={{
                            padding: "2px 6px",
                            background: "var(--color-accent-subtle)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "var(--font-size-xs)",
                            color: "var(--color-accent)",
                        }}
                    >
                        {t}
                    </span>
                ))}
                <span
                    style={{
                        marginLeft: "auto",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-tertiary)",
                    }}
                >
                    {new Date(problem.createdAt).toLocaleDateString("ko-KR")}
                </span>
            </div>

            {/* 반려 사유 */}
            {problem.status === "rejected" && problem.reviewNote && (
                <div
                    style={{
                        padding: "8px 12px",
                        background: "var(--color-error-subtle)",
                        borderRadius: "var(--radius-lg)",
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-error-text)",
                    }}
                >
                    <strong>반려 사유:</strong> {problem.reviewNote}
                </div>
            )}

            {/* 게시됨 통계 */}
            {problem.status === "published" && (
                <div
                    style={{
                        display: "flex",
                        gap: 16,
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-tertiary)",
                    }}
                >
                    <span>조회 {problem.viewCount.toLocaleString()}</span>
                    <span>풀기 {problem.solveCount.toLocaleString()}</span>
                    <span>
                        추천 {problem.voteUp} / 비추천 {problem.voteDown}
                    </span>
                    {problem.acceptanceRate && (
                        <span>정답률 {Number(problem.acceptanceRate).toFixed(1)}%</span>
                    )}
                </div>
            )}

            {/* 액션 버튼 */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    borderTop: "1px solid var(--color-border-default)",
                    paddingTop: 12,
                }}
            >
                {/* 수정: draft 또는 rejected */}
                {(problem.status === "draft" ||
                    problem.status === "rejected") && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(problem)}
                    >
                        수정
                    </Button>
                )}

                {/* 검토 요청: draft만 */}
                {problem.status === "draft" && (
                    <Button
                        variant="primary"
                        size="sm"
                        loading={actionLoading === `review_${problem.id}`}
                        onClick={() => onSubmitReview(problem)}
                    >
                        검토 요청
                    </Button>
                )}

                {/* 삭제: draft 또는 rejected */}
                {(problem.status === "draft" ||
                    problem.status === "rejected") && (
                    <Button
                        variant="danger"
                        size="sm"
                        loading={actionLoading === `delete_${problem.id}`}
                        onClick={() => onDelete(problem)}
                        style={{ marginLeft: "auto" }}
                    >
                        삭제
                    </Button>
                )}

                {/* 게시됨: 문제 보기 링크 */}
                {problem.status === "published" && (
                    <a
                        href={`/problems/${problem.id}`}
                        style={{
                            padding: "4px 12px",
                            background: "var(--color-bg-sunken)",
                            border: "1px solid var(--color-border-default)",
                            borderRadius: "var(--radius-xl)",
                            fontSize: "var(--font-size-sm)",
                            color: "var(--color-text-secondary)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        문제 보기 →
                    </a>
                )}
            </div>
        </div>
    );
}

// ── 빈 상태 ──────────────────────────────────────────────────────────────────

function EmptyState({ status }: { status: ProblemStatus | "all" }) {
    const navigate = useNavigate();
    return (
        <div
            style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
            }}
        >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
            <div
                style={{
                    fontSize: "var(--font-size-lg)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-text-secondary)",
                    marginBottom: 8,
                }}
            >
                {status === "all"
                    ? "아직 만든 문제가 없습니다"
                    : `${STATUS_TABS.find((t) => t.value === status)?.label} 상태의 문제가 없습니다`}
            </div>
            {status === "all" && (
                <>
                    <div
                        style={{
                            fontSize: "var(--font-size-base)",
                            color: "var(--color-text-tertiary)",
                            marginBottom: 24,
                        }}
                    >
                        직접 만든 문제를 다른 사용자와 공유해보세요
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => navigate("/problems/create")}
                    >
                        첫 문제 만들기
                    </Button>
                </>
            )}
        </div>
    );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export function MyProblemsPage() {
    const navigate = useNavigate();
    const [problems, setProblems] = useState<ProblemSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<ProblemStatus | "all">("all");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProblemSummary | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const fetchProblems = useCallback(() => {
        setLoading(true);
        setError("");
        problemApi
            .myList()
            .then(({ data }) => setProblems(data))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchProblems();
    }, [fetchProblems]);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleEdit = (p: ProblemSummary) => {
        navigate(`/problems/create?edit=${p.id}`);
    };

    const handleSubmitReview = async (p: ProblemSummary) => {
        const key = `review_${p.id}`;
        setActionLoading(key);
        try {
            await problemApi.submitForReview(p.id);
            setProblems((prev) =>
                prev.map((x) =>
                    x.id === p.id ? { ...x, status: "pending_review" } : x,
                ),
            );
            showToast("검토 요청이 완료되었습니다.", "success");
        } catch (e) {
            showToast(e instanceof Error ? e.message : "요청 실패", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        const key = `delete_${deleteTarget.id}`;
        setActionLoading(key);
        try {
            await problemApi.delete(deleteTarget.id);
            setProblems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
            showToast("문제가 삭제되었습니다.", "success");
        } catch (e) {
            showToast(e instanceof Error ? e.message : "삭제 실패", "error");
        } finally {
            setActionLoading(null);
            setDeleteTarget(null);
        }
    };

    const filtered =
        activeTab === "all"
            ? problems
            : problems.filter((p) => p.status === activeTab);

    const countByStatus = (s: ProblemStatus | "all") =>
        s === "all"
            ? problems.length
            : problems.filter((p) => p.status === s).length;

    return (
        <div
            className="grid-container"
            style={{ paddingTop: 32, paddingBottom: 48 }}
        >
            {/* 페이지 헤더 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 24,
                    flexWrap: "wrap",
                    gap: 12,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: "var(--font-size-2xl)",
                            fontWeight: "var(--font-weight-bold)",
                            color: "var(--color-text-primary)",
                            margin: 0,
                        }}
                    >
                        내 문제
                    </h1>
                    <p
                        style={{
                            fontSize: "var(--font-size-md)",
                            color: "var(--color-text-secondary)",
                            margin: "4px 0 0",
                        }}
                    >
                        직접 만든 문제를 관리하고 검토 요청을 보내세요
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate("/problems/create")}
                    leftIcon={<span>+</span>}
                >
                    문제 만들기
                </Button>
            </div>

            {/* 상태 탭 */}
            <div
                style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 20,
                    overflowX: "auto",
                    paddingBottom: 4,
                }}
            >
                {STATUS_TABS.map((tab) => {
                    const cnt = countByStatus(tab.value);
                    const active = activeTab === tab.value;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => setActiveTab(tab.value)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "var(--radius-full)",
                                border: "1px solid",
                                borderColor: active
                                    ? "var(--color-accent)"
                                    : "var(--color-border-default)",
                                background: active
                                    ? "var(--color-accent-subtle)"
                                    : "var(--color-bg-base)",
                                color: active
                                    ? "var(--color-accent)"
                                    : "var(--color-text-secondary)",
                                fontSize: "var(--font-size-sm)",
                                fontWeight: active
                                    ? "var(--font-weight-semibold)"
                                    : "var(--font-weight-regular)",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                transition: "all 150ms",
                            }}
                        >
                            {tab.label}
                            {cnt > 0 && (
                                <span
                                    style={{
                                        padding: "1px 6px",
                                        borderRadius: "var(--radius-full)",
                                        fontSize: "var(--font-size-xs)",
                                        background: active
                                            ? "var(--color-accent)"
                                            : "var(--color-bg-sunken)",
                                        color: active
                                            ? "var(--color-text-on-accent)"
                                            : "var(--color-text-tertiary)",
                                        fontWeight:
                                            "var(--font-weight-semibold)",
                                    }}
                                >
                                    {cnt}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* 로딩 / 에러 */}
            {loading && (
                <div
                    style={{
                        textAlign: "center",
                        padding: 64,
                        color: "var(--color-text-secondary)",
                    }}
                >
                    불러오는 중...
                </div>
            )}
            {error && (
                <div
                    style={{
                        padding: "12px 16px",
                        background: "var(--color-error-subtle)",
                        borderRadius: "var(--radius-lg)",
                        color: "var(--color-error-text)",
                        fontSize: "var(--font-size-md)",
                        marginBottom: 16,
                    }}
                >
                    {error}
                </div>
            )}

            {/* 문제 목록 */}
            {!loading && !error && (
                filtered.length === 0 ? (
                    <EmptyState status={activeTab} />
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        {filtered.map((p) => (
                            <ProblemCard
                                key={p.id}
                                problem={p}
                                onEdit={handleEdit}
                                onSubmitReview={handleSubmitReview}
                                onDelete={setDeleteTarget}
                                actionLoading={actionLoading}
                            />
                        ))}
                    </div>
                )
            )}

            {/* 삭제 확인 모달 */}
            {deleteTarget && (
                <DeleteConfirm
                    title={deleteTarget.title}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteTarget(null)}
                    loading={actionLoading === `delete_${deleteTarget.id}`}
                />
            )}

            {/* 토스트 알림 */}
            {toast && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        padding: "12px 20px",
                        borderRadius: "var(--radius-xl)",
                        background:
                            toast.type === "success"
                                ? "var(--color-success)"
                                : "var(--color-error)",
                        color: "#fff",
                        fontSize: "var(--font-size-md)",
                        fontWeight: "var(--font-weight-semibold)",
                        boxShadow: "var(--shadow-xl)",
                        zIndex: 2000,
                        animation: "fadeIn 200ms ease",
                    }}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
