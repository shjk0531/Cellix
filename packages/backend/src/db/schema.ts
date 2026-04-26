import { pgTable, uuid, text, integer, timestamp, jsonb, boolean, numeric } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: text('role', { enum: ['student', 'admin'] }).notNull().default('student'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const problems = pgTable('problems', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull(),
    type: text('type').notNull(),
    score: integer('score').notNull().default(100),
    timeLimit: integer('time_limit'),
    templateWorkbook: jsonb('template_workbook'),
    answerWorkbook: jsonb('answer_workbook'),
    gradingConfig: jsonb('grading_config').notNull(),
    hints: text('hints').array(),
    tags: text('tags').array(),
    isPublished: boolean('is_published').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const submissions = pgTable('submissions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    problemId: uuid('problem_id').notNull().references(() => problems.id),
    submittedWorkbook: jsonb('submitted_workbook').notNull(),
    totalScore: numeric('total_score', { precision: 5, scale: 2 }),
    maxScore: integer('max_score'),
    percentage: numeric('percentage', { precision: 5, scale: 2 }),
    status: text('status', { enum: ['pending', 'graded', 'error'] }).notNull().default('pending'),
    feedback: jsonb('feedback'),
    timeSpentSeconds: integer('time_spent_seconds'),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

export const userProgress = pgTable('user_progress', {
    userId: uuid('user_id').notNull().references(() => users.id),
    problemId: uuid('problem_id').notNull().references(() => problems.id),
    bestScore: numeric('best_score', { precision: 5, scale: 2 }),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
})
