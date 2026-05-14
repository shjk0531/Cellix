import { Global, Module } from "@nestjs/common";
import { db } from "./index.js";

export const DB_TOKEN = Symbol("DB_TOKEN");

@Global()
@Module({
    providers: [{ provide: DB_TOKEN, useValue: db }],
    exports: [DB_TOKEN],
})
export class DatabaseModule {}
