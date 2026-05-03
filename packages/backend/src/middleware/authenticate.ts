import type { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    try {
        const payload = await request.jwtVerify<{
            sub: string;
            role: "student" | "admin";
        }>();
        request.userId = payload.sub;
        request.userRole = payload.role;
    } catch {
        reply.status(401).send({
            success: false,
            error: "Unauthorized",
            code: "UNAUTHORIZED",
        });
    }
}
