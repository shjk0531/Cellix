import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const configDir = dirname(fileURLToPath(import.meta.url));
const envFiles = [
    resolve(process.cwd(), ".env"),
    resolve(configDir, "../../../../.env"),
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
        (value) => value ?? process.env.GRADING_SERVICE_PORT,
        z.coerce.number().int().min(1).max(65535).default(3003),
    ),
    HOST: z.string().default("0.0.0.0"),
    CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
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
