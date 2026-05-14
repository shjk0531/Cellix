import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["student", "admin", "company"] })
        .notNull()
        .default("student"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    skillLevel: integer("skill_level").notNull().default(1),
    solvedCount: integer("solved_count").notNull().default(0),
    submittedCount: integer("submitted_count").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
