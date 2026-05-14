import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { AuthRepository } from "./auth.repository.js";

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
    constructor(
        @Inject(AuthRepository)
        private readonly authRepository: AuthRepository,
    ) {}

    async register(input: { email: string; password: string; name: string }) {
        const existing = await this.authRepository.findByEmail(input.email);
        if (existing) {
            throw new ConflictException({
                error: "Email already in use",
                code: "CONFLICT",
            });
        }
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
        return this.authRepository.create({
            email: input.email,
            passwordHash,
            name: input.name,
        });
    }

    async login(input: { email: string; password: string }) {
        const user = await this.authRepository.findByEmail(input.email);
        if (!user) {
            throw new UnauthorizedException({
                error: "Invalid credentials",
                code: "UNAUTHORIZED",
            });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException({
                error: "Invalid credentials",
                code: "UNAUTHORIZED",
            });
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    }

    async findById(id: string) {
        return this.authRepository.findById(id);
    }
}
