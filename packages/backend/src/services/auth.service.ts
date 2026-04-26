import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import type { DB } from '../db/index.js'
import { users } from '../db/schema.js'

const SALT_ROUNDS = 12

export interface RegisterInput {
    email: string
    password: string
    name: string
}

export interface LoginInput {
    email: string
    password: string
}

export const authService = {
    async register(db: DB, input: RegisterInput) {
        const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) })
        if (existing) {
            throw Object.assign(new Error('Email already in use'), { code: 'CONFLICT' })
        }
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)
        const [user] = await db
            .insert(users)
            .values({ email: input.email, passwordHash, name: input.name })
            .returning({ id: users.id, email: users.email, name: users.name, role: users.role })
        return user
    },

    async login(db: DB, input: LoginInput) {
        const user = await db.query.users.findFirst({ where: eq(users.email, input.email) })
        if (!user) {
            throw Object.assign(new Error('Invalid credentials'), { code: 'UNAUTHORIZED' })
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash)
        if (!valid) {
            throw Object.assign(new Error('Invalid credentials'), { code: 'UNAUTHORIZED' })
        }
        return { id: user.id, email: user.email, name: user.name, role: user.role }
    },

    async findById(db: DB, id: string) {
        return db.query.users.findFirst({
            where: eq(users.id, id),
            columns: { passwordHash: false },
        })
    },
}
