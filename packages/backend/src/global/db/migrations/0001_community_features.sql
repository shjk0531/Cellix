-- 0001_community_features.sql
-- Cellix 커뮤니티 + 기업 테스트 + 스킬 체크 + 뱃지 기능 마이그레이션
-- 생성일: 2026-05-05

-- ── 1. users 테이블 컬럼 추가 ────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN "bio" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_url" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "linkedin_url" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "skill_level" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "solved_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "submitted_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ── 2. problems 테이블 컬럼 추가 ─────────────────────────────────────────────
ALTER TABLE "problems" ADD COLUMN "level" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "source_type" text NOT NULL DEFAULT 'official';
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "category" text NOT NULL DEFAULT 'practice';
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "step_level" integer;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "status" text NOT NULL DEFAULT 'draft';
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "estimated_minutes" integer;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "vote_up" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "vote_down" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "view_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "acceptance_rate" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "solve_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "review_note" text;
--> statement-breakpoint

-- 기존 데이터: is_published 상태를 status로 동기화
UPDATE "problems" SET "status" = 'published' WHERE "is_published" = true;
--> statement-breakpoint
UPDATE "problems" SET "status" = 'draft' WHERE "is_published" = false;
--> statement-breakpoint

-- type 컬럼을 enum 값으로 정규화 (기존 임의 문자열 → 지정값)
-- 기존에 이미 올바른 값이 있다면 이 UPDATE는 영향 없음
UPDATE "problems"
    SET "type" = 'mixed'
    WHERE "type" NOT IN ('formula','formatting','chart','table','function','data','mixed');
--> statement-breakpoint

-- ── 3. problems 인덱스 추가 ──────────────────────────────────────────────────
CREATE INDEX "idx_problems_source_type" ON "problems" ("source_type");
--> statement-breakpoint
CREATE INDEX "idx_problems_category" ON "problems" ("category");
--> statement-breakpoint
CREATE INDEX "idx_problems_status" ON "problems" ("status");
--> statement-breakpoint
CREATE INDEX "idx_problems_level" ON "problems" ("level");
--> statement-breakpoint
CREATE INDEX "idx_problems_type" ON "problems" ("type");
--> statement-breakpoint
CREATE INDEX "idx_problems_created_by" ON "problems" ("created_by");
--> statement-breakpoint
CREATE INDEX "idx_problems_step_level" ON "problems" ("step_level");
--> statement-breakpoint

-- ── 4. user_progress 테이블 컬럼 추가 ────────────────────────────────────────
ALTER TABLE "user_progress" ADD COLUMN "progress_status" text NOT NULL DEFAULT 'attempted';
--> statement-breakpoint
ALTER TABLE "user_progress" ADD COLUMN "solved_at" timestamp;
--> statement-breakpoint

-- ── 5. problem_votes ─────────────────────────────────────────────────────────
CREATE TABLE "problem_votes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "problem_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "vote_type" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_votes"
    ADD CONSTRAINT "problem_votes_problem_id_problems_id_fk"
    FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "problem_votes"
    ADD CONSTRAINT "problem_votes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_problem_votes_problem_user"
    ON "problem_votes" ("problem_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_problem_votes_problem_id" ON "problem_votes" ("problem_id");
--> statement-breakpoint

-- ── 6. bookmarks ─────────────────────────────────────────────────────────────
CREATE TABLE "bookmarks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "problem_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "bookmarks"
    ADD CONSTRAINT "bookmarks_problem_id_problems_id_fk"
    FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bookmarks_user_problem"
    ON "bookmarks" ("user_id", "problem_id");
--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user_id" ON "bookmarks" ("user_id");
--> statement-breakpoint

-- ── 7. problem_solutions ──────────────────────────────────────────────────────
CREATE TABLE "problem_solutions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "problem_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "submission_id" uuid NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "vote_up" integer NOT NULL DEFAULT 0,
    "view_count" integer NOT NULL DEFAULT 0,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_solutions"
    ADD CONSTRAINT "problem_solutions_problem_id_problems_id_fk"
    FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "problem_solutions"
    ADD CONSTRAINT "problem_solutions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "problem_solutions"
    ADD CONSTRAINT "problem_solutions_submission_id_submissions_id_fk"
    FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_solutions_submission"
    ON "problem_solutions" ("submission_id");
--> statement-breakpoint
CREATE INDEX "idx_solutions_problem_id" ON "problem_solutions" ("problem_id");
--> statement-breakpoint
CREATE INDEX "idx_solutions_user_id" ON "problem_solutions" ("user_id");
--> statement-breakpoint

-- ── 8. solution_votes ────────────────────────────────────────────────────────
CREATE TABLE "solution_votes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "solution_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "solution_votes"
    ADD CONSTRAINT "solution_votes_solution_id_problem_solutions_id_fk"
    FOREIGN KEY ("solution_id") REFERENCES "public"."problem_solutions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "solution_votes"
    ADD CONSTRAINT "solution_votes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_solution_votes_sol_user"
    ON "solution_votes" ("solution_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_solution_votes_solution_id" ON "solution_votes" ("solution_id");
--> statement-breakpoint

-- ── 9. problem_posts ─────────────────────────────────────────────────────────
CREATE TABLE "problem_posts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "problem_id" uuid NOT NULL,
    "author_id" uuid NOT NULL,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "post_type" text NOT NULL DEFAULT 'question',
    "vote_up" integer NOT NULL DEFAULT 0,
    "vote_down" integer NOT NULL DEFAULT 0,
    "comment_count" integer NOT NULL DEFAULT 0,
    "view_count" integer NOT NULL DEFAULT 0,
    "is_pinned" boolean NOT NULL DEFAULT false,
    "is_deleted" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_posts"
    ADD CONSTRAINT "problem_posts_problem_id_problems_id_fk"
    FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "problem_posts"
    ADD CONSTRAINT "problem_posts_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "idx_problem_posts_problem_id" ON "problem_posts" ("problem_id");
--> statement-breakpoint
CREATE INDEX "idx_problem_posts_author_id" ON "problem_posts" ("author_id");
--> statement-breakpoint
CREATE INDEX "idx_problem_posts_created_at" ON "problem_posts" ("created_at");
--> statement-breakpoint

-- ── 10. problem_post_comments ────────────────────────────────────────────────
CREATE TABLE "problem_post_comments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "post_id" uuid NOT NULL,
    "author_id" uuid NOT NULL,
    "parent_comment_id" uuid,
    "content" text NOT NULL,
    "vote_up" integer NOT NULL DEFAULT 0,
    "vote_down" integer NOT NULL DEFAULT 0,
    "is_deleted" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_post_comments"
    ADD CONSTRAINT "problem_post_comments_post_id_problem_posts_id_fk"
    FOREIGN KEY ("post_id") REFERENCES "public"."problem_posts"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "problem_post_comments"
    ADD CONSTRAINT "problem_post_comments_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "problem_post_comments"
    ADD CONSTRAINT "problem_post_comments_parent_id_self_fk"
    FOREIGN KEY ("parent_comment_id") REFERENCES "public"."problem_post_comments"("id")
    ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "idx_post_comments_post_id" ON "problem_post_comments" ("post_id");
--> statement-breakpoint
CREATE INDEX "idx_post_comments_parent_id" ON "problem_post_comments" ("parent_comment_id");
--> statement-breakpoint

-- ── 11. post_votes ───────────────────────────────────────────────────────────
CREATE TABLE "post_votes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "post_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "vote_type" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_votes"
    ADD CONSTRAINT "post_votes_post_id_problem_posts_id_fk"
    FOREIGN KEY ("post_id") REFERENCES "public"."problem_posts"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "post_votes"
    ADD CONSTRAINT "post_votes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_post_votes_post_user" ON "post_votes" ("post_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_post_votes_post_id" ON "post_votes" ("post_id");
--> statement-breakpoint

-- ── 12. comment_votes ────────────────────────────────────────────────────────
CREATE TABLE "comment_votes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "comment_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "vote_type" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_votes"
    ADD CONSTRAINT "comment_votes_comment_id_problem_post_comments_id_fk"
    FOREIGN KEY ("comment_id") REFERENCES "public"."problem_post_comments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "comment_votes"
    ADD CONSTRAINT "comment_votes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_comment_votes_comment_user"
    ON "comment_votes" ("comment_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_comment_votes_comment_id" ON "comment_votes" ("comment_id");
--> statement-breakpoint

-- ── 13. boards (자유 게시판) ─────────────────────────────────────────────────
CREATE TABLE "boards" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "author_id" uuid NOT NULL,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "board_type" text NOT NULL DEFAULT 'general',
    "vote_up" integer NOT NULL DEFAULT 0,
    "vote_down" integer NOT NULL DEFAULT 0,
    "comment_count" integer NOT NULL DEFAULT 0,
    "view_count" integer NOT NULL DEFAULT 0,
    "is_pinned" boolean NOT NULL DEFAULT false,
    "is_deleted" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards"
    ADD CONSTRAINT "boards_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "idx_boards_author_id" ON "boards" ("author_id");
--> statement-breakpoint
CREATE INDEX "idx_boards_board_type" ON "boards" ("board_type");
--> statement-breakpoint
CREATE INDEX "idx_boards_created_at" ON "boards" ("created_at");
--> statement-breakpoint

-- ── 14. board_comments ───────────────────────────────────────────────────────
CREATE TABLE "board_comments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "board_id" uuid NOT NULL,
    "author_id" uuid NOT NULL,
    "parent_comment_id" uuid,
    "content" text NOT NULL,
    "vote_up" integer NOT NULL DEFAULT 0,
    "vote_down" integer NOT NULL DEFAULT 0,
    "is_deleted" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_comments"
    ADD CONSTRAINT "board_comments_board_id_boards_id_fk"
    FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "board_comments"
    ADD CONSTRAINT "board_comments_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "board_comments"
    ADD CONSTRAINT "board_comments_parent_id_self_fk"
    FOREIGN KEY ("parent_comment_id") REFERENCES "public"."board_comments"("id")
    ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "idx_board_comments_board_id" ON "board_comments" ("board_id");
--> statement-breakpoint
CREATE INDEX "idx_board_comments_parent_id" ON "board_comments" ("parent_comment_id");
--> statement-breakpoint

-- ── 15. board_votes ──────────────────────────────────────────────────────────
CREATE TABLE "board_votes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "board_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "vote_type" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_votes"
    ADD CONSTRAINT "board_votes_board_id_boards_id_fk"
    FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "board_votes"
    ADD CONSTRAINT "board_votes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_board_votes_board_user" ON "board_votes" ("board_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_board_votes_board_id" ON "board_votes" ("board_id");
--> statement-breakpoint

-- ── 16. board_comment_votes ──────────────────────────────────────────────────
CREATE TABLE "board_comment_votes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "comment_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "vote_type" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_comment_votes"
    ADD CONSTRAINT "board_comment_votes_comment_id_board_comments_id_fk"
    FOREIGN KEY ("comment_id") REFERENCES "public"."board_comments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "board_comment_votes"
    ADD CONSTRAINT "board_comment_votes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_board_comment_votes_comment_user"
    ON "board_comment_votes" ("comment_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_board_comment_votes_comment_id"
    ON "board_comment_votes" ("comment_id");
--> statement-breakpoint

-- ── 17. badges ───────────────────────────────────────────────────────────────
CREATE TABLE "badges" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text NOT NULL,
    "icon_url" text,
    "badge_type" text NOT NULL,
    "condition" jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "badges_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- ── 18. user_badges ──────────────────────────────────────────────────────────
CREATE TABLE "user_badges" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "badge_id" uuid NOT NULL,
    "earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badges"
    ADD CONSTRAINT "user_badges_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "user_badges"
    ADD CONSTRAINT "user_badges_badge_id_badges_id_fk"
    FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_badges_user_badge"
    ON "user_badges" ("user_id", "badge_id");
--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_id" ON "user_badges" ("user_id");
--> statement-breakpoint

-- ── 19. skill_checks ─────────────────────────────────────────────────────────
CREATE TABLE "skill_checks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "level" integer NOT NULL,
    "time_limit_minutes" integer NOT NULL DEFAULT 60,
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_skill_checks_level" ON "skill_checks" ("level");
--> statement-breakpoint
CREATE INDEX "idx_skill_checks_status" ON "skill_checks" ("status");
--> statement-breakpoint

-- ── 20. skill_check_problems ─────────────────────────────────────────────────
CREATE TABLE "skill_check_problems" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "skill_check_id" uuid NOT NULL,
    "problem_id" uuid NOT NULL,
    "order_index" integer NOT NULL DEFAULT 0,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skill_check_problems"
    ADD CONSTRAINT "skill_check_problems_skill_check_id_skill_checks_id_fk"
    FOREIGN KEY ("skill_check_id") REFERENCES "public"."skill_checks"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "skill_check_problems"
    ADD CONSTRAINT "skill_check_problems_problem_id_problems_id_fk"
    FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_skill_check_problem"
    ON "skill_check_problems" ("skill_check_id", "problem_id");
--> statement-breakpoint
CREATE INDEX "idx_skill_check_problems_check_id"
    ON "skill_check_problems" ("skill_check_id");
--> statement-breakpoint

-- ── 21. skill_check_attempts ─────────────────────────────────────────────────
CREATE TABLE "skill_check_attempts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "skill_check_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "attempt_status" text NOT NULL DEFAULT 'in_progress',
    "total_score" numeric(7, 2),
    "max_score" integer,
    "certified_level" integer,
    "started_at" timestamp DEFAULT now() NOT NULL,
    "completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "skill_check_attempts"
    ADD CONSTRAINT "skill_check_attempts_skill_check_id_skill_checks_id_fk"
    FOREIGN KEY ("skill_check_id") REFERENCES "public"."skill_checks"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "skill_check_attempts"
    ADD CONSTRAINT "skill_check_attempts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "idx_skill_check_attempts_skill_check_id"
    ON "skill_check_attempts" ("skill_check_id");
--> statement-breakpoint
CREATE INDEX "idx_skill_check_attempts_user_id"
    ON "skill_check_attempts" ("user_id");
--> statement-breakpoint

-- ── 22. companies ────────────────────────────────────────────────────────────
CREATE TABLE "companies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "company_name" text NOT NULL,
    "logo_url" text,
    "description" text,
    "website_url" text,
    "employee_range" text,
    "industry" text,
    "is_verified" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "companies_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "companies"
    ADD CONSTRAINT "companies_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint

-- ── 23. company_test_sets ────────────────────────────────────────────────────
CREATE TABLE "company_test_sets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "time_limit_minutes" integer,
    "status" text NOT NULL DEFAULT 'draft',
    "is_archive_public" boolean NOT NULL DEFAULT false,
    "starts_at" timestamp,
    "ends_at" timestamp,
    "invite_token" text,
    "max_participants" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "company_test_sets_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
ALTER TABLE "company_test_sets"
    ADD CONSTRAINT "company_test_sets_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "idx_company_test_sets_company_id" ON "company_test_sets" ("company_id");
--> statement-breakpoint
CREATE INDEX "idx_company_test_sets_status" ON "company_test_sets" ("status");
--> statement-breakpoint
CREATE INDEX "idx_company_test_sets_invite_token" ON "company_test_sets" ("invite_token");
--> statement-breakpoint

-- ── 24. company_test_problems ────────────────────────────────────────────────
CREATE TABLE "company_test_problems" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "test_set_id" uuid NOT NULL,
    "problem_id" uuid NOT NULL,
    "order_index" integer NOT NULL DEFAULT 0,
    "score_override" integer,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_test_problems"
    ADD CONSTRAINT "company_test_problems_test_set_id_company_test_sets_id_fk"
    FOREIGN KEY ("test_set_id") REFERENCES "public"."company_test_sets"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "company_test_problems"
    ADD CONSTRAINT "company_test_problems_problem_id_problems_id_fk"
    FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_test_set_problem"
    ON "company_test_problems" ("test_set_id", "problem_id");
--> statement-breakpoint
CREATE INDEX "idx_test_problems_test_set_id"
    ON "company_test_problems" ("test_set_id");
--> statement-breakpoint

-- ── 25. company_test_participants ────────────────────────────────────────────
CREATE TABLE "company_test_participants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "test_set_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "participant_status" text NOT NULL DEFAULT 'invited',
    "total_score" numeric(7, 2),
    "max_score" integer,
    "started_at" timestamp,
    "completed_at" timestamp,
    "joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_test_participants"
    ADD CONSTRAINT "company_test_participants_test_set_id_company_test_sets_id_fk"
    FOREIGN KEY ("test_set_id") REFERENCES "public"."company_test_sets"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "company_test_participants"
    ADD CONSTRAINT "company_test_participants_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_test_participants_set_user"
    ON "company_test_participants" ("test_set_id", "user_id");
--> statement-breakpoint
CREATE INDEX "idx_test_participants_test_set_id"
    ON "company_test_participants" ("test_set_id");
--> statement-breakpoint
CREATE INDEX "idx_test_participants_user_id"
    ON "company_test_participants" ("user_id");

-- ── 기본 뱃지 데이터 삽입 ────────────────────────────────────────────────────
INSERT INTO "badges" ("name", "description", "badge_type", "condition") VALUES
    ('첫 도전', '첫 번째 문제를 제출했습니다.', 'solve', '{"type":"submit_count","threshold":1}'),
    ('열심히 푸는 중', '10개 문제를 풀었습니다.', 'solve', '{"type":"solve_count","threshold":10}'),
    ('엑셀 입문자', '50개 문제를 풀었습니다.', 'solve', '{"type":"solve_count","threshold":50}'),
    ('엑셀 고수', '100개 문제를 풀었습니다.', 'solve', '{"type":"solve_count","threshold":100}'),
    ('3일 연속', '3일 연속 문제를 풀었습니다.', 'streak', '{"type":"streak","threshold":3}'),
    ('7일 연속', '7일 연속 문제를 풀었습니다.', 'streak', '{"type":"streak","threshold":7}'),
    ('30일 연속', '30일 연속 문제를 풀었습니다.', 'streak', '{"type":"streak","threshold":30}'),
    ('Lv.2 달성', '스킬 레벨 2에 도달했습니다.', 'level', '{"type":"skill_level","threshold":2}'),
    ('Lv.3 달성', '스킬 레벨 3에 도달했습니다.', 'level', '{"type":"skill_level","threshold":3}'),
    ('커뮤니티 기여자', '게시판 글을 10개 작성했습니다.', 'community', '{"type":"post_count","threshold":10}');
