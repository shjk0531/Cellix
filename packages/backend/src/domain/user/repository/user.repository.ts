import { eq, desc } from "drizzle-orm";
import type { DB } from "../../../global/db/index.js";
import {
    users,
    userProgress,
    problems,
    submissions,
} from "../../../global/db/schema.js";

export const userRepository = {
    async findById(db: DB, id: string) {
        return db.query.users.findFirst({
            where: eq(users.id, id),
            columns: { passwordHash: false },
        });
    },

    async update(db: DB, id: string, data: { name?: string }) {
        const [row] = await db
            .update(users)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
            });
        return row;
    },

    async findProgress(db: DB, userId: string) {
        return db
            .select({
                problemId: userProgress.problemId,
                bestScore: userProgress.bestScore,
                attempts: userProgress.attempts,
                lastAttemptAt: userProgress.lastAttemptAt,
                problemTitle: problems.title,
                problemDifficulty: problems.difficulty,
                problemType: problems.type,
                problemScore: problems.score,
            })
            .from(userProgress)
            .innerJoin(problems, eq(userProgress.problemId, problems.id))
            .where(eq(userProgress.userId, userId));
    },

    async findSubmissions(db: DB, userId: string, page: number, limit: number) {
        const offset = (page - 1) * limit;
        return db
            .select()
            .from(submissions)
            .where(eq(submissions.userId, userId))
            .orderBy(desc(submissions.submittedAt))
            .limit(limit)
            .offset(offset);
    },

    async findAll(db: DB) {
        return db.query.users.findMany({
            columns: { passwordHash: false },
        });
    },
};
