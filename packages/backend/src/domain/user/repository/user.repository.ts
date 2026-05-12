import { Inject, Injectable } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { DB_TOKEN } from "../../../global/db/db.module.js";
import type { DB } from "../../../global/db/index.js";
import {
    users,
    userProgress,
    problems,
    submissions,
} from "../../../global/db/schema.js";

@Injectable()
export class UserRepository {
    constructor(@Inject(DB_TOKEN) private readonly db: DB) {}

    async findById(id: string) {
        return this.db.query.users.findFirst({
            where: eq(users.id, id),
            columns: { passwordHash: false },
        });
    }

    async update(id: string, data: { name?: string }) {
        const [row] = await this.db
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
    }

    async findProgress(userId: string) {
        return this.db
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
    }

    async findSubmissions(userId: string, page: number, limit: number) {
        const offset = (page - 1) * limit;
        return this.db
            .select()
            .from(submissions)
            .where(eq(submissions.userId, userId))
            .orderBy(desc(submissions.submittedAt))
            .limit(limit)
            .offset(offset);
    }

    async findAll() {
        return this.db.query.users.findMany({
            columns: { passwordHash: false },
        });
    }
}
