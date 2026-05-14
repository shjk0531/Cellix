import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB_TOKEN } from "./db/db.module.js";
import type { DB } from "./db/index.js";
import { users } from "./db/schema.js";

@Injectable()
export class AuthRepository {
    constructor(@Inject(DB_TOKEN) private readonly db: DB) {}

    async findByEmail(email: string) {
        return this.db.query.users.findFirst({ where: eq(users.email, email) });
    }

    async create(input: { email: string; passwordHash: string; name: string }) {
        const [user] = await this.db.insert(users).values(input).returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
        });
        return user;
    }

    async findById(id: string) {
        return this.db.query.users.findFirst({
            where: eq(users.id, id),
            columns: { passwordHash: false },
        });
    }
}
