import type { submissions } from "../../../global/db/schema.js";
export type {
    CellGradingRule,
    TableGradingRule,
    ChartGradingRule,
    CellRuleResult,
    GradingConfig,
    GradingResult,
} from "@cellix/shared";

export type Submission = typeof submissions.$inferSelect;
