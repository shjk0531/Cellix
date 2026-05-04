import { z } from "zod";

export const RegisterBodyDto = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(100),
});

export const LoginBodyDto = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export type RegisterBody = z.infer<typeof RegisterBodyDto>;
export type LoginBody = z.infer<typeof LoginBodyDto>;
