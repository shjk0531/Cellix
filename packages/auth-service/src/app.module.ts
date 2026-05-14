import { Controller, Get, Module } from "@nestjs/common";
import { JwtModule, type JwtModuleOptions } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { env } from "./config/env.js";
import { DatabaseModule } from "./db/db.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Controller("api/auth")
class HealthController {
    @Get("health")
    health() {
        return { status: "ok", service: "auth", env: env.NODE_ENV };
    }
}

@Module({
    imports: [
        DatabaseModule,
        RedisModule,
        JwtModule.register({
            secret: env.JWT_SECRET ?? "dev-secret-change-in-prod-min32chars!!",
            signOptions: {
                expiresIn: env.JWT_EXPIRES_IN as NonNullable<
                    JwtModuleOptions["signOptions"]
                >["expiresIn"],
            },
        }),
    ],
    controllers: [AuthController, HealthController],
    providers: [AuthRepository, AuthService],
})
export class AppModule {}
