import type { ApiResponse as SharedApiResponse } from "@cellix/shared";

export class ApiResponse {
    static success<T>(data: T, message = "OK"): SharedApiResponse<T> {
        return {
            success: true,
            code: "OK",
            message,
            data,
            timestamp: new Date().toISOString(),
        };
    }

    static error(code: string, message: string): SharedApiResponse<never> {
        return {
            success: false,
            code,
            message,
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    static isApiResponse(value: unknown): value is SharedApiResponse {
        return (
            typeof value === "object" &&
            value !== null &&
            "success" in value &&
            "code" in value &&
            "message" in value &&
            "data" in value &&
            "timestamp" in value
        );
    }
}
