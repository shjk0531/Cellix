import { eq } from "drizzle-orm";
import type { DB } from "../../../global/db/index.js";
import { users } from "../../../global/db/schema.js";

export const authRepository = {
    async findByEmail(db: DB, email: string) {
        return db.query.users.findFirst({ where: eq(users.email, email) });
    },

    async create(
        db: DB,
        input: { email: string; passwordHash: string; name: string },
    ) {
        const [user] = await db.insert(users).values(input).returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
        });
        return user;
    },

    async findById(db: DB, id: string) {
        return db.query.users.findFirst({
            where: eq(users.id, id),
            columns: { passwordHash: false },
        });
    },
};
