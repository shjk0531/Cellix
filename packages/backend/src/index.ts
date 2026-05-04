import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./global/config/env.js";
import type { ApiResponse } from "@cellix/shared";

const app = Fastify({
    logger:
        env.NODE_ENV === "development"
            ? { transport: { target: "pino-pretty" } }
            : true,
});

await app.register(cors, { origin: env.CORS_ORIGIN });

app.get(
    "/api/health",
    async (): Promise<ApiResponse<{ status: string; env: string }>> => {
        return { success: true, data: { status: "ok", env: env.NODE_ENV } };
    },
);

try {
    await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
