import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from "@nestjs/common";
import { ApiResponse } from "./api-response.js";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<{
            status: (code: number) => { json: (body: unknown) => void };
        }>();

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            const payload =
                typeof body === "object" && body !== null
                    ? (body as Record<string, unknown>)
                    : { error: exception.message };
            response.status(status).json(
                ApiResponse.error(
                    String(payload.code ?? this.codeFromStatus(status)),
                    String(payload.message ?? payload.error ?? exception.message),
                ),
            );
            return;
        }

        if (exception instanceof Error) {
            this.logger.error(exception.message, exception.stack);
        }
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiResponse.error("INTERNAL_ERROR", "Internal server error"),
        );
    }

    private codeFromStatus(status: number): string {
        return status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
    }
}
