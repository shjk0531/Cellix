export { submissionController } from "./controller/submission.controller.js";
export { submissionService } from "./service/submission.service.js";
export { gradingService, GradingService } from "./service/grading.service.js";
export type {
    Submission,
    GradingConfig,
    GradingResult,
    CellGradingRule,
    TableGradingRule,
    ChartGradingRule,
    CellRuleResult,
} from "./entity/submission.entity.js";
