import { Controller, Get, Module } from "@nestjs/common";
import { AuthModule } from "./domain/auth/index.js";
import { ProblemModule } from "./domain/problem/index.js";
import { SubmissionModule } from "./domain/submission/index.js";
import { UserModule } from "./domain/user/index.js";
import { GlobalModule } from "./global/global.module.js";
import { env } from "./global/config/index.js";

@Controller("api")
class HealthController {
    @Get("health")
    health() {
        return { status: "ok", env: env.NODE_ENV };
    }
}

@Module({
    imports: [
        GlobalModule,
        AuthModule,
        ProblemModule,
        SubmissionModule,
        UserModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
