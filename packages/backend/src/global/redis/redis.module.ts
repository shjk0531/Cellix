import { Global, Module } from "@nestjs/common";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const REDIS_TOKEN = Symbol("REDIS_TOKEN");

@Global()
@Module({
    providers: [
        {
            provide: REDIS_TOKEN,
            useFactory: () => new Redis(env.REDIS_URL),
        },
    ],
    exports: [REDIS_TOKEN],
})
export class RedisModule {}
