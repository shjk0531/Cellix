import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthUser {
    id: string;
    role: "student" | "admin" | "company";
}

export const AuthUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthUser => {
        const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
        return request.user;
    },
);
