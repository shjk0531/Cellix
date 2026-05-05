import type { Config } from 'drizzle-kit'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env') })

export default {
    schema: './src/global/db/schema.ts',
    out: './src/global/db/migrations',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
