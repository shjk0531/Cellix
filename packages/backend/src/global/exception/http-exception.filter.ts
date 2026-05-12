import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<{
            status: (code: number) => {
                json: (body: unknown) => void;
            };
        }>();

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            const payload =
                typeof body === "object" && body !== null
                    ? (body as Record<string, unknown>)
                    : { error: exception.message };
            response.status(status).json({
                success: false,
                error: String(payload.error ?? exception.message),
                code: String(payload.code ?? this.codeFromStatus(status)),
            });
            return;
        }

        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Internal server error",
            code: "INTERNAL_ERROR",
        });
    }

    private codeFromStatus(status: number): string {
        switch (status) {
            case HttpStatus.UNAUTHORIZED:
                return "UNAUTHORIZED";
            case HttpStatus.FORBIDDEN:
                return "FORBIDDEN";
            case HttpStatus.NOT_FOUND:
                return "NOT_FOUND";
            case HttpStatus.CONFLICT:
                return "CONFLICT";
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return "VALIDATION_ERROR";
            default:
                return status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
        }
    }
}
