import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
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
        const formatted = result.error.errors
            .map((e) => `  ${e.path.join(".")}: ${e.message}`)
            .join("\n");
        throw new Error(`Invalid environment variables:\n${formatted}`);
    }

    return result.data;
}

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
