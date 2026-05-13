import { z } from "zod";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const configDir = dirname(fileURLToPath(import.meta.url));
const envFiles = [
    resolve(process.cwd(), ".env"),
    resolve(configDir, "../../../../../.env"),
];

for (const path of envFiles) {
    if (existsSync(path)) {
        loadDotenv({ path, override: false });
        break;
    }
}

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),

    PORT: z.preprocess(
        (value) => value ?? process.env.BACKEND_PORT,
        z.coerce.number().int().min(1).max(65535).default(3001),
    ),
    HOST: z.string().default("0.0.0.0"),

    DATABASE_URL: z.string().url().startsWith("postgresql://", {
        message: "DATABASE_URL must be a postgresql:// URI",
    }),

    REDIS_URL: z.string().url().startsWith("redis://", {
        message: "REDIS_URL must be a redis:// URI",
    }),

    CORS_ORIGIN: z.string().url().default("http://localhost:5173"),

    JWT_SECRET: z.string().min(32).optional(),
    JWT_EXPIRES_IN: z.string().default("7d"),
});

function parseEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((e) => `  ${e.path.join(".")}: ${e.message}`)
            .join("\n");
        throw new Error(`Invalid environment variables:\n${formatted}`);
    }

    return result.data;
}

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
