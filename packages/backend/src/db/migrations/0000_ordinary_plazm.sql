CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"difficulty" text NOT NULL,
	"type" text NOT NULL,
	"score" integer DEFAULT 100 NOT NULL,
	"time_limit" integer,
	"template_workbook" jsonb,
	"answer_workbook" jsonb,
	"grading_config" jsonb NOT NULL,
	"hints" text[],
	"tags" text[],
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"submitted_workbook" jsonb NOT NULL,
	"total_score" numeric(5, 2),
	"max_score" integer,
	"percentage" numeric(5, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"feedback" jsonb,
	"time_spent_seconds" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"best_score" numeric(5, 2),
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE no action ON UPDATE no action;