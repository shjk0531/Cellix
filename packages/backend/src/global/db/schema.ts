import {
    pgTable,
    uuid,
    text,
    integer,
    timestamp,
    jsonb,
    boolean,
    numeric,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";

// ── users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    // student: 일반 학습자, admin: 관리자, company: 기업 계정
    role: text("role", { enum: ["student", "admin", "company"] })
        .notNull()
        .default("student"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    // 엑셀 스킬 레벨 1~5 (프로그래머스 레벨과 유사)
    skillLevel: integer("skill_level").notNull().default(1),
    // 역정규화 캐시: solved/submitted 카운트
    solvedCount: integer("solved_count").notNull().default(0),
    submittedCount: integer("submitted_count").notNull().default(0),
    // 연속 풀기 일수
    streak: integer("streak").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── problems ──────────────────────────────────────────────────────────────────
export const problems = pgTable(
    "problems",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        title: text("title").notNull(),
        description: text("description").notNull(),
        difficulty: text("difficulty", {
            enum: ["easy", "medium", "hard"],
        }).notNull(),
        // 세분화 레벨 (1~5, 프로그래머스 Lv.1~5 대응)
        level: integer("level").notNull().default(1),
        type: text("type", {
            enum: [
                "formula",      // 수식
                "formatting",   // 서식
                "chart",        // 차트
                "table",        // 표/피벗
                "function",     // 함수
                "data",         // 정렬/필터/유효성
                "mixed",        // 복합
            ],
        }).notNull(),
        // "official": admin이 등록한 공식 문제
        // "community": 일반 사용자가 등록한 문제
        sourceType: text("source_type", {
            enum: ["official", "community"],
        })
            .notNull()
            .default("official"),
        // "practice": 단계별 학습 / "exam": 실전 시험 / "skill_check": 스킬 체크
        category: text("category", {
            enum: ["practice", "exam", "skill_check"],
        })
            .notNull()
            .default("practice"),
        // practice 카테고리의 단계 번호 (1부터 시작)
        stepLevel: integer("step_level"),
        // "draft": 작성 중 (본인만 조회)
        // "pending_review": admin 검토 요청
        // "published": 게시됨
        // "rejected": admin 반려
        status: text("status", {
            enum: ["draft", "pending_review", "published", "rejected"],
        })
            .notNull()
            .default("draft"),
        score: integer("score").notNull().default(100),
        timeLimit: integer("time_limit"),
        // 예상 풀이 시간 (분)
        estimatedMinutes: integer("estimated_minutes"),
        templateWorkbook: jsonb("template_workbook"),
        answerWorkbook: jsonb("answer_workbook"),
        gradingConfig: jsonb("grading_config").notNull(),
        hints: text("hints").array(),
        tags: text("tags").array(),
        // 추천/비추천 역정규화 카운터
        voteUp: integer("vote_up").notNull().default(0),
        voteDown: integer("vote_down").notNull().default(0),
        viewCount: integer("view_count").notNull().default(0),
        // 정답률 캐시 (0.00 ~ 100.00)
        acceptanceRate: numeric("acceptance_rate", { precision: 5, scale: 2 }),
        // 푼 사람 수 캐시
        solveCount: integer("solve_count").notNull().default(0),
        // admin 반려 사유
        reviewNote: text("review_note"),
        // deprecated: status = "published" 로 대체 예정
        isPublished: boolean("is_published").notNull().default(false),
        createdBy: uuid("created_by").references(() => users.id),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_problems_source_type").on(table.sourceType),
        index("idx_problems_category").on(table.category),
        index("idx_problems_status").on(table.status),
        index("idx_problems_difficulty").on(table.difficulty),
        index("idx_problems_level").on(table.level),
        index("idx_problems_type").on(table.type),
        index("idx_problems_created_by").on(table.createdBy),
        index("idx_problems_step_level").on(table.stepLevel),
    ],
);

// ── submissions ───────────────────────────────────────────────────────────────
export const submissions = pgTable("submissions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    problemId: uuid("problem_id")
        .notNull()
        .references(() => problems.id),
    submittedWorkbook: jsonb("submitted_workbook").notNull(),
    totalScore: numeric("total_score", { precision: 5, scale: 2 }),
    maxScore: integer("max_score"),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    status: text("status", { enum: ["pending", "graded", "error"] })
        .notNull()
        .default("pending"),
    feedback: jsonb("feedback"),
    timeSpentSeconds: integer("time_spent_seconds"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

// ── user_progress ─────────────────────────────────────────────────────────────
export const userProgress = pgTable("user_progress", {
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    problemId: uuid("problem_id")
        .notNull()
        .references(() => problems.id),
    bestScore: numeric("best_score", { precision: 5, scale: 2 }),
    attempts: integer("attempts").notNull().default(0),
    // "solved": 정답, "attempted": 시도 중, "skipped": 건너뜀
    progressStatus: text("progress_status", {
        enum: ["solved", "attempted", "skipped"],
    }).notNull().default("attempted"),
    lastAttemptAt: timestamp("last_attempt_at"),
    solvedAt: timestamp("solved_at"),
});

// ── problem_votes ─────────────────────────────────────────────────────────────
// 문제 추천/비추천 (사용자당 1회)
export const problemVotes = pgTable(
    "problem_votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        problemId: uuid("problem_id")
            .notNull()
            .references(() => problems.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        voteType: text("vote_type", { enum: ["up", "down"] }).notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_problem_votes_problem_user").on(
            table.problemId,
            table.userId,
        ),
        index("idx_problem_votes_problem_id").on(table.problemId),
    ],
);

// ── bookmarks ─────────────────────────────────────────────────────────────────
// 문제 북마크/스크랩 (프로그래머스 "스크랩" 기능)
export const bookmarks = pgTable(
    "bookmarks",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        problemId: uuid("problem_id")
            .notNull()
            .references(() => problems.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_bookmarks_user_problem").on(
            table.userId,
            table.problemId,
        ),
        index("idx_bookmarks_user_id").on(table.userId),
    ],
);

// ── problem_solutions ─────────────────────────────────────────────────────────
// 풀이 공유 (프로그래머스 "다른 사람의 풀이" 기능)
// 정답(graded, 100점)을 받은 사용자가 자신의 풀이를 공개 공유
export const problemSolutions = pgTable(
    "problem_solutions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        problemId: uuid("problem_id")
            .notNull()
            .references(() => problems.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        // 연결된 제출 ID (100점짜리 제출만 허용)
        submissionId: uuid("submission_id")
            .notNull()
            .references(() => submissions.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        description: text("description"),
        voteUp: integer("vote_up").notNull().default(0),
        viewCount: integer("view_count").notNull().default(0),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_solutions_submission").on(table.submissionId),
        index("idx_solutions_problem_id").on(table.problemId),
        index("idx_solutions_user_id").on(table.userId),
    ],
);

// ── solution_votes ────────────────────────────────────────────────────────────
export const solutionVotes = pgTable(
    "solution_votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        solutionId: uuid("solution_id")
            .notNull()
            .references(() => problemSolutions.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_solution_votes_sol_user").on(
            table.solutionId,
            table.userId,
        ),
        index("idx_solution_votes_solution_id").on(table.solutionId),
    ],
);

// ── problem_posts ─────────────────────────────────────────────────────────────
// 문제별 Q&A 게시판 글 (프로그래머스 "질문하기" 기능)
export const problemPosts = pgTable(
    "problem_posts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        problemId: uuid("problem_id")
            .notNull()
            .references(() => problems.id, { onDelete: "cascade" }),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        content: text("content").notNull(),
        // "question": 질문 / "discussion": 토론 / "solution_tip": 풀이 팁
        postType: text("post_type", {
            enum: ["question", "discussion", "solution_tip"],
        })
            .notNull()
            .default("question"),
        voteUp: integer("vote_up").notNull().default(0),
        voteDown: integer("vote_down").notNull().default(0),
        commentCount: integer("comment_count").notNull().default(0),
        viewCount: integer("view_count").notNull().default(0),
        isPinned: boolean("is_pinned").notNull().default(false),
        isDeleted: boolean("is_deleted").notNull().default(false),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_problem_posts_problem_id").on(table.problemId),
        index("idx_problem_posts_author_id").on(table.authorId),
        index("idx_problem_posts_created_at").on(table.createdAt),
    ],
);

// ── problem_post_comments ─────────────────────────────────────────────────────
// Q&A 게시판 댓글 (대댓글 1단계 지원)
export const problemPostComments = pgTable(
    "problem_post_comments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        postId: uuid("post_id")
            .notNull()
            .references(() => problemPosts.id, { onDelete: "cascade" }),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        // null = 최상위 댓글, 값 있음 = 대댓글
        parentCommentId: uuid("parent_comment_id"),
        content: text("content").notNull(),
        voteUp: integer("vote_up").notNull().default(0),
        voteDown: integer("vote_down").notNull().default(0),
        isDeleted: boolean("is_deleted").notNull().default(false),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_post_comments_post_id").on(table.postId),
        index("idx_post_comments_parent_id").on(table.parentCommentId),
    ],
);

// ── post_votes ────────────────────────────────────────────────────────────────
export const postVotes = pgTable(
    "post_votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        postId: uuid("post_id")
            .notNull()
            .references(() => problemPosts.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        voteType: text("vote_type", { enum: ["up", "down"] }).notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_post_votes_post_user").on(table.postId, table.userId),
        index("idx_post_votes_post_id").on(table.postId),
    ],
);

// ── comment_votes ─────────────────────────────────────────────────────────────
export const commentVotes = pgTable(
    "comment_votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        commentId: uuid("comment_id")
            .notNull()
            .references(() => problemPostComments.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        voteType: text("vote_type", { enum: ["up", "down"] }).notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_comment_votes_comment_user").on(
            table.commentId,
            table.userId,
        ),
        index("idx_comment_votes_comment_id").on(table.commentId),
    ],
);

// ── boards ────────────────────────────────────────────────────────────────────
// 자유 게시판 (프로그래머스 커뮤니티와 유사)
export const boards = pgTable(
    "boards",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        content: text("content").notNull(),
        // "general": 자유 / "notice": 공지 / "tip": 엑셀 팁 / "career": 취업/커리어
        boardType: text("board_type", {
            enum: ["general", "notice", "tip", "career"],
        })
            .notNull()
            .default("general"),
        voteUp: integer("vote_up").notNull().default(0),
        voteDown: integer("vote_down").notNull().default(0),
        commentCount: integer("comment_count").notNull().default(0),
        viewCount: integer("view_count").notNull().default(0),
        isPinned: boolean("is_pinned").notNull().default(false),
        isDeleted: boolean("is_deleted").notNull().default(false),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_boards_author_id").on(table.authorId),
        index("idx_boards_board_type").on(table.boardType),
        index("idx_boards_created_at").on(table.createdAt),
    ],
);

// ── board_comments ────────────────────────────────────────────────────────────
export const boardComments = pgTable(
    "board_comments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        boardId: uuid("board_id")
            .notNull()
            .references(() => boards.id, { onDelete: "cascade" }),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        parentCommentId: uuid("parent_comment_id"),
        content: text("content").notNull(),
        voteUp: integer("vote_up").notNull().default(0),
        voteDown: integer("vote_down").notNull().default(0),
        isDeleted: boolean("is_deleted").notNull().default(false),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_board_comments_board_id").on(table.boardId),
        index("idx_board_comments_parent_id").on(table.parentCommentId),
    ],
);

// ── board_votes ───────────────────────────────────────────────────────────────
export const boardVotes = pgTable(
    "board_votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        boardId: uuid("board_id")
            .notNull()
            .references(() => boards.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        voteType: text("vote_type", { enum: ["up", "down"] }).notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_board_votes_board_user").on(
            table.boardId,
            table.userId,
        ),
        index("idx_board_votes_board_id").on(table.boardId),
    ],
);

// ── board_comment_votes ───────────────────────────────────────────────────────
export const boardCommentVotes = pgTable(
    "board_comment_votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        commentId: uuid("comment_id")
            .notNull()
            .references(() => boardComments.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        voteType: text("vote_type", { enum: ["up", "down"] }).notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_board_comment_votes_comment_user").on(
            table.commentId,
            table.userId,
        ),
        index("idx_board_comment_votes_comment_id").on(table.commentId),
    ],
);

// ── badges ────────────────────────────────────────────────────────────────────
// 뱃지 정의 (시스템이 관리)
export const badges = pgTable("badges", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description").notNull(),
    iconUrl: text("icon_url"),
    // "solve": 문제 풀기 달성 / "streak": 연속 풀기 / "level": 레벨 달성 / "community": 커뮤니티 활동
    badgeType: text("badge_type", {
        enum: ["solve", "streak", "level", "community", "special"],
    }).notNull(),
    // 획득 조건 (JSON: { type, threshold } 형태)
    condition: jsonb("condition").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── user_badges ───────────────────────────────────────────────────────────────
export const userBadges = pgTable(
    "user_badges",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        badgeId: uuid("badge_id")
            .notNull()
            .references(() => badges.id, { onDelete: "cascade" }),
        earnedAt: timestamp("earned_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_user_badges_user_badge").on(
            table.userId,
            table.badgeId,
        ),
        index("idx_user_badges_user_id").on(table.userId),
    ],
);

// ── skill_checks ──────────────────────────────────────────────────────────────
// 스킬 체크 세트 (프로그래머스 스킬 체크 테스트와 유사)
export const skillChecks = pgTable(
    "skill_checks",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        title: text("title").notNull(),
        description: text("description").notNull(),
        // 1~5 레벨
        level: integer("level").notNull(),
        timeLimitMinutes: integer("time_limit_minutes").notNull().default(60),
        // "active": 응시 가능 / "archived": 비활성
        status: text("status", { enum: ["active", "archived"] })
            .notNull()
            .default("active"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_skill_checks_level").on(table.level),
        index("idx_skill_checks_status").on(table.status),
    ],
);

// ── skill_check_problems ──────────────────────────────────────────────────────
export const skillCheckProblems = pgTable(
    "skill_check_problems",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        skillCheckId: uuid("skill_check_id")
            .notNull()
            .references(() => skillChecks.id, { onDelete: "cascade" }),
        problemId: uuid("problem_id")
            .notNull()
            .references(() => problems.id, { onDelete: "restrict" }),
        orderIndex: integer("order_index").notNull().default(0),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_skill_check_problem").on(
            table.skillCheckId,
            table.problemId,
        ),
        index("idx_skill_check_problems_check_id").on(table.skillCheckId),
    ],
);

// ── skill_check_attempts ──────────────────────────────────────────────────────
// 스킬 체크 응시 이력
export const skillCheckAttempts = pgTable(
    "skill_check_attempts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        skillCheckId: uuid("skill_check_id")
            .notNull()
            .references(() => skillChecks.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        // "in_progress" | "completed" | "timed_out"
        attemptStatus: text("attempt_status", {
            enum: ["in_progress", "completed", "timed_out"],
        })
            .notNull()
            .default("in_progress"),
        totalScore: numeric("total_score", { precision: 7, scale: 2 }),
        maxScore: integer("max_score"),
        // 인증된 레벨 (합격 시 부여)
        certifiedLevel: integer("certified_level"),
        startedAt: timestamp("started_at").notNull().defaultNow(),
        completedAt: timestamp("completed_at"),
    },
    (table) => [
        index("idx_skill_check_attempts_skill_check_id").on(table.skillCheckId),
        index("idx_skill_check_attempts_user_id").on(table.userId),
    ],
);

// ── companies ─────────────────────────────────────────────────────────────────
// role = "company"인 users와 1:1 연결
export const companies = pgTable("companies", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    logoUrl: text("logo_url"),
    description: text("description"),
    websiteUrl: text("website_url"),
    employeeRange: text("employee_range", {
        enum: ["1-50", "51-200", "201-1000", "1001+"],
    }),
    industry: text("industry"),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── company_test_sets ─────────────────────────────────────────────────────────
// 기업이 구성하는 채용 테스트 문제집
export const companyTestSets = pgTable(
    "company_test_sets",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        companyId: uuid("company_id")
            .notNull()
            .references(() => companies.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        description: text("description"),
        timeLimitMinutes: integer("time_limit_minutes"),
        // "draft": 준비 중 / "active": 진행 중 / "closed": 종료
        status: text("status", {
            enum: ["draft", "active", "closed"],
        })
            .notNull()
            .default("draft"),
        // 종료 후 기출 공개 여부 (기업 선택)
        isArchivePublic: boolean("is_archive_public").notNull().default(false),
        startsAt: timestamp("starts_at"),
        endsAt: timestamp("ends_at"),
        // 초대 링크 토큰 (crypto.randomBytes 기반)
        inviteToken: text("invite_token").unique(),
        maxParticipants: integer("max_participants"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_company_test_sets_company_id").on(table.companyId),
        index("idx_company_test_sets_status").on(table.status),
        index("idx_company_test_sets_invite_token").on(table.inviteToken),
    ],
);

// ── company_test_problems ─────────────────────────────────────────────────────
// 테스트 세트에 포함된 문제 (기존 공개 문제 재사용 + 기업 전용 문제 모두 가능)
export const companyTestProblems = pgTable(
    "company_test_problems",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        testSetId: uuid("test_set_id")
            .notNull()
            .references(() => companyTestSets.id, { onDelete: "cascade" }),
        problemId: uuid("problem_id")
            .notNull()
            .references(() => problems.id, { onDelete: "restrict" }),
        orderIndex: integer("order_index").notNull().default(0),
        // 테스트 세트 내 배점 오버라이드 (null이면 문제 기본 score 사용)
        scoreOverride: integer("score_override"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_test_set_problem").on(
            table.testSetId,
            table.problemId,
        ),
        index("idx_test_problems_test_set_id").on(table.testSetId),
    ],
);

// ── company_test_participants ─────────────────────────────────────────────────
export const companyTestParticipants = pgTable(
    "company_test_participants",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        testSetId: uuid("test_set_id")
            .notNull()
            .references(() => companyTestSets.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        // "invited": 초대 / "joined": 참여 중 / "completed": 제출 완료
        participantStatus: text("participant_status", {
            enum: ["invited", "joined", "completed"],
        })
            .notNull()
            .default("invited"),
        totalScore: numeric("total_score", { precision: 7, scale: 2 }),
        maxScore: integer("max_score"),
        startedAt: timestamp("started_at"),
        completedAt: timestamp("completed_at"),
        joinedAt: timestamp("joined_at").notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_test_participants_set_user").on(
            table.testSetId,
            table.userId,
        ),
        index("idx_test_participants_test_set_id").on(table.testSetId),
        index("idx_test_participants_user_id").on(table.userId),
    ],
);
