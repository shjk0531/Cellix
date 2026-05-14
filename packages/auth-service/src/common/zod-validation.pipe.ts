import {
    Injectable,
    PipeTransform,
    UnprocessableEntityException,
} from "@nestjs/common";
import type { ZodType } from "zod";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
    constructor(private readonly schema: ZodType<T>) {}

    transform(value: unknown): T {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            throw new UnprocessableEntityException({
                error: result.error.issues[0]?.message ?? "Invalid request",
                code: "VALIDATION_ERROR",
            });
        }
        return result.data;
    }
}
