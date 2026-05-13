import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
    constructor(
        @Inject(JwtService)
        private readonly jwtService: JwtService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; role: "student" | "admin" | "company" };
        }>();
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        if (type !== "Bearer" || !token) return true;

        try {
            const payload = await this.jwtService.verifyAsync<{
                sub: string;
                role: "student" | "admin" | "company";
            }>(token);
            request.user = { id: payload.sub, role: payload.role };
        } catch {
            /* public access */
        }
        return true;
    }
}
