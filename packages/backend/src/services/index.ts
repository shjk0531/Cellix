export { authService } from "./auth.service.js";
export type { RegisterInput, LoginInput } from "./auth.service.js";

export { gradingService, GradingService } from "./grading.service.js";
export type {
    CellGradingRule,
    TableGradingRule,
    ChartGradingRule,
    GradingConfig,
    CellRuleResult,
    GradingResult,
} from "./grading.service.js";
