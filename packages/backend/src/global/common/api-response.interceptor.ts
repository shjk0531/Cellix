import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            map((value: unknown) => {
                if (value instanceof Buffer) return value;
                if (
                    typeof value === "object" &&
                    value !== null &&
                    "success" in value
                ) {
                    return value;
                }
                return { success: true, data: value };
            }),
        );
    }
}
