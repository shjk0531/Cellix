import { apiClient } from "./client";
import type { ProblemSummary } from "./types";
import type {
    ProblemSourceType,
    ProblemCategory,
    ProblemStatus,
    DifficultyLevel,
    ProblemType,
} from "@cellix/shared";
import type { SerializedWorkbookData } from "@cellix/shared";

// ── 문제 목록 조회 파라미터 ───────────────────────────────────────────────────

export interface GetProblemsParams {
    page?: number;
    limit?: number;
    difficulty?: DifficultyLevel;
    level?: number;
    type?: ProblemType;
    sourceType?: ProblemSourceType;
    category?: ProblemCategory;
    status?: ProblemStatus;
    search?: string;
    tags?: string;
    myOnly?: boolean;
    sortBy?: "newest" | "vote" | "view" | "acceptance" | "difficulty";
}

export interface ProblemsListResponse {
    data: ProblemSummary[];
    total: number;
    page: number;
}

// ── 문제 생성/수정 페이로드 ───────────────────────────────────────────────────

export interface GradingCell {
    sheetId: string;
    address: string;
    expectedValue?: string | number | boolean | null;
    tolerance?: number;
    checkFormula?: boolean;
    formulaPattern?: string;
    scoreWeight: number;
}

export interface GradingConfig {
    cells?: GradingCell[];
    tables?: { name: string; checkColumns?: boolean; scoreWeight: number }[];
    charts?: { type?: string; scoreWeight: number }[];
    totalScore: number;
}

export interface CreateProblemPayload {
    title: string;
    description: string;
    difficulty: DifficultyLevel;
    level: number;
    type: ProblemType;
    category: ProblemCategory;
    stepLevel?: number;
    score: number;
    timeLimit?: number;
    estimatedMinutes?: number;
    templateWorkbook?: SerializedWorkbookData | null;
    answerWorkbook?: SerializedWorkbookData | null;
    gradingConfig: GradingConfig;
    hints?: string[];
    tags?: string[];
}

// ── API 함수들 ────────────────────────────────────────────────────────────────

function buildQueryString(params: GetProblemsParams): string {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.difficulty) q.set("difficulty", params.difficulty);
    if (params.level) q.set("level", String(params.level));
    if (params.type) q.set("type", params.type);
    if (params.sourceType) q.set("sourceType", params.sourceType);
    if (params.category) q.set("category", params.category);
    if (params.status) q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    if (params.tags) q.set("tags", params.tags);
    if (params.myOnly) q.set("myOnly", "true");
    if (params.sortBy) q.set("sortBy", params.sortBy);
    const qs = q.toString();
    return qs ? `?${qs}` : "";
}

export const problemApi = {
    list(params: GetProblemsParams = {}): Promise<ProblemsListResponse> {
        return apiClient.get(`/api/problems${buildQueryString(params)}`);
    },

    get(id: string): Promise<{ data: ProblemSummary }> {
        return apiClient.get(`/api/problems/${id}`);
    },

    create(payload: CreateProblemPayload): Promise<{ data: ProblemSummary }> {
        return apiClient.post("/api/problems", payload);
    },

    update(
        id: string,
        payload: Partial<CreateProblemPayload>,
    ): Promise<{ data: ProblemSummary }> {
        return apiClient.put(`/api/problems/${id}`, payload);
    },

    delete(id: string): Promise<void> {
        return apiClient.delete(`/api/problems/${id}`);
    },

    // draft → pending_review (일반 사용자 검토 요청)
    submitForReview(id: string): Promise<{ data: ProblemSummary }> {
        return apiClient.post(`/api/problems/${id}/submit-review`);
    },

    // admin 검토 처리
    review(
        id: string,
        verdict: "published" | "rejected",
        reviewNote?: string,
    ): Promise<{ data: ProblemSummary }> {
        return apiClient.patch(`/api/problems/${id}/review`, {
            verdict,
            reviewNote,
        });
    },

    // 내 문제 목록 (myOnly=true 래퍼)
    myList(params: Omit<GetProblemsParams, "myOnly"> = {}): Promise<ProblemsListResponse> {
        return problemApi.list({ ...params, myOnly: true, limit: 50 });
    },
};
