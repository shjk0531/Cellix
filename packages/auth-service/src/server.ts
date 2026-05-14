import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ApiResponseInterceptor } from "./common/api-response.interceptor.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { env } from "./config/env.js";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule, {
    logger:
        env.NODE_ENV === "development"
            ? ["log", "error", "warn", "debug", "verbose"]
            : ["log", "error", "warn"],
});

app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalInterceptors(new ApiResponseInterceptor());

try {
    await app.listen(env.PORT, env.HOST);
} catch (err) {
    console.error(err);
    process.exit(1);
}
