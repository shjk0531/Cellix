import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; role: "student" | "admin" | "company" };
        }>();
        const token = this.extractToken(request.headers.authorization);
        if (!token) {
            throw new UnauthorizedException("Unauthorized");
        }

        try {
            const payload = await this.jwtService.verifyAsync<{
                sub: string;
                role: "student" | "admin" | "company";
            }>(token);
            request.user = { id: payload.sub, role: payload.role };
            return true;
        } catch {
            throw new UnauthorizedException("Unauthorized");
        }
    }

    private extractToken(header?: string): string | undefined {
        const [type, token] = header?.split(" ") ?? [];
        return type === "Bearer" ? token : undefined;
    }
}
