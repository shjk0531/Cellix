export type ApiSuccessCode = "OK";

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    code: ApiSuccessCode;
    message: string;
    data: T;
    timestamp: string;
}

export interface ApiErrorResponse {
    success: false;
    code: string;
    message: string;
    data: null;
    timestamp: string;
}

export type ApiResponse<T = unknown> =
    | ApiSuccessResponse<T>
    | ApiErrorResponse;
