import { Global, Module } from "@nestjs/common";
import { JwtModule, type JwtModuleOptions } from "@nestjs/jwt";
import { env } from "../config/env.js";
import { AdminGuard } from "./admin.guard.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { OptionalJwtAuthGuard } from "./optional-jwt-auth.guard.js";

@Global()
@Module({
    imports: [
        JwtModule.register({
            secret: env.JWT_SECRET ?? "dev-secret-change-in-prod-min32chars!!",
            signOptions: {
                expiresIn: env.JWT_EXPIRES_IN as NonNullable<
                    JwtModuleOptions["signOptions"]
                >["expiresIn"],
            },
        }),
    ],
    providers: [AdminGuard, JwtAuthGuard, OptionalJwtAuthGuard],
    exports: [AdminGuard, JwtAuthGuard, OptionalJwtAuthGuard, JwtModule],
})
export class SecurityModule {}
