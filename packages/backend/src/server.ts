import { buildApp } from "./app.js";
import { env } from "./global/config/index.js";

const app = await buildApp();

try {
    await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
