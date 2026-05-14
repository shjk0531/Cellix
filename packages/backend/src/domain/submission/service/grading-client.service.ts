import {
    BadGatewayException,
    Inject,
    Injectable,
    ServiceUnavailableException,
} from "@nestjs/common";
import type { ApiResponse, GradingConfig, GradingResult } from "@cellix/shared";
import { env } from "../../../global/config/index.js";

@Injectable()
export class GradingClientService {
    async grade(
        submittedRaw: unknown,
        config: GradingConfig,
    ): Promise<GradingResult> {
        let response: Response;
        try {
            response = await fetch(`${env.GRADING_SERVICE_URL}/internal/grade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workbookData: submittedRaw, config }),
            });
        } catch {
            throw new ServiceUnavailableException({
                error: "Grading service unavailable",
                code: "GRADING_SERVICE_UNAVAILABLE",
            });
        }

        let body: ApiResponse<GradingResult>;
        try {
            body = (await response.json()) as ApiResponse<GradingResult>;
        } catch {
            throw new BadGatewayException({
                error: "Invalid grading service response",
                code: "GRADING_SERVICE_BAD_RESPONSE",
            });
        }

        if (!response.ok || !body.success || !body.data) {
            throw new BadGatewayException({
                error: body.message || "Grading service failed",
                code: body.code || "GRADING_SERVICE_ERROR",
            });
        }

        return body.data;
    }
}
