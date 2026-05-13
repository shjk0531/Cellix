import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "../repository/user.repository.js";

@Injectable()
export class UserService {
    constructor(
        @Inject(UserRepository)
        private readonly userRepository: UserRepository,
    ) {}

    async getMe(userId: string) {
        return this.userRepository.findById(userId);
    }

    async updateMe(userId: string, data: { name?: string }) {
        return this.userRepository.update(userId, data);
    }

    async getProgress(userId: string) {
        return this.userRepository.findProgress(userId);
    }

    async getSubmissions(userId: string, page: number, limit: number) {
        return this.userRepository.findSubmissions(userId, page, limit);
    }

    async getAllUsers() {
        return this.userRepository.findAll();
    }
}
