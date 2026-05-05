import type { VoteType } from "./exam";

// ── 문제 Q&A 게시판 ───────────────────────────────────────────────────────────

export type PostType = "question" | "discussion" | "solution_tip";

export interface ProblemPost {
    id: string;
    problemId: string;
    authorId: string;
    authorName?: string;
    title: string;
    content: string;
    postType: PostType;
    voteUp: number;
    voteDown: number;
    commentCount: number;
    viewCount: number;
    isPinned: boolean;
    isDeleted: boolean;
    myVote?: VoteType | null;
    createdAt: string;
    updatedAt: string;
}

export interface ProblemPostComment {
    id: string;
    postId: string;
    authorId: string;
    authorName?: string;
    // null = 최상위 댓글
    parentCommentId: string | null;
    content: string;
    voteUp: number;
    voteDown: number;
    isDeleted: boolean;
    myVote?: VoteType | null;
    // 대댓글 (중첩 응답 시)
    replies?: ProblemPostComment[];
    createdAt: string;
    updatedAt: string;
}

// ── 자유 게시판 ───────────────────────────────────────────────────────────────

export type BoardType = "general" | "notice" | "tip" | "career";

export interface BoardPost {
    id: string;
    authorId: string;
    authorName?: string;
    title: string;
    content: string;
    boardType: BoardType;
    voteUp: number;
    voteDown: number;
    commentCount: number;
    viewCount: number;
    isPinned: boolean;
    isDeleted: boolean;
    myVote?: VoteType | null;
    createdAt: string;
    updatedAt: string;
}

export interface BoardComment {
    id: string;
    boardId: string;
    authorId: string;
    authorName?: string;
    parentCommentId: string | null;
    content: string;
    voteUp: number;
    voteDown: number;
    isDeleted: boolean;
    myVote?: VoteType | null;
    replies?: BoardComment[];
    createdAt: string;
    updatedAt: string;
}

// ── 게시판 공통 필터 ──────────────────────────────────────────────────────────

export interface BoardListFilter {
    boardType?: BoardType;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "newest" | "vote" | "view";
}

export interface PostListFilter {
    postType?: PostType;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "newest" | "vote" | "view";
}
