import type { Config } from 'drizzle-kit'

export default {
    schema: './src/global/db/schema.ts',
    out: './src/global/db/migrations',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
