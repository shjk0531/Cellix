import bcrypt from "bcrypt";
import type { DB } from "../../../global/db/index.js";
import { authRepository } from "../repository/auth.repository.js";

const SALT_ROUNDS = 10;

export const authService = {
    async register(
        db: DB,
        input: { email: string; password: string; name: string },
    ) {
        const existing = await authRepository.findByEmail(db, input.email);
        if (existing) {
            throw Object.assign(new Error("Email already in use"), {
                statusCode: 409,
                code: "CONFLICT",
            });
        }
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
        return authRepository.create(db, {
            email: input.email,
            passwordHash,
            name: input.name,
        });
    },

    async login(db: DB, input: { email: string; password: string }) {
        const user = await authRepository.findByEmail(db, input.email);
        if (!user) {
            throw Object.assign(new Error("Invalid credentials"), {
                statusCode: 401,
                code: "UNAUTHORIZED",
            });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
            throw Object.assign(new Error("Invalid credentials"), {
                statusCode: 401,
                code: "UNAUTHORIZED",
            });
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    },

    async findById(db: DB, id: string) {
        return authRepository.findById(db, id);
    },
};
