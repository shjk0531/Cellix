import type { users, userProgress } from "../../../global/db/schema.js";

export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;
export type UserProgress = typeof userProgress.$inferSelect;
