import type { DB } from "../../../global/db/index.js";
import { userRepository } from "../repository/user.repository.js";

export const userService = {
    async getMe(db: DB, userId: string) {
        return userRepository.findById(db, userId);
    },

    async updateMe(db: DB, userId: string, data: { name?: string }) {
        return userRepository.update(db, userId, data);
    },

    async getProgress(db: DB, userId: string) {
        return userRepository.findProgress(db, userId);
    },

    async getSubmissions(db: DB, userId: string, page: number, limit: number) {
        return userRepository.findSubmissions(db, userId, page, limit);
    },

    async getAllUsers(db: DB) {
        return userRepository.findAll(db);
    },
};
