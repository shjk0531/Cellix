import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { ApiResponse } from "./api-response.js";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            map((value: unknown) => {
                if (ApiResponse.isApiResponse(value)) return value;
                return ApiResponse.success(value);
            }),
        );
    }
}
