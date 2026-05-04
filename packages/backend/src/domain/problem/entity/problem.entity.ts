import type { problems } from "../../../global/db/schema.js";

export type Problem = typeof problems.$inferSelect;
export type PublicProblem = Omit<Problem, "answerWorkbook" | "gradingConfig">;
