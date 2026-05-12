import { Global, Module } from "@nestjs/common";
import { CellixConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./db/db.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { SecurityModule } from "./security/security.module.js";
import { WebsocketModule } from "./websocket/websocket.module.js";

@Global()
@Module({
    imports: [
        CellixConfigModule,
        DatabaseModule,
        RedisModule,
        SecurityModule,
        WebsocketModule,
    ],
    exports: [
        CellixConfigModule,
        DatabaseModule,
        RedisModule,
        SecurityModule,
        WebsocketModule,
    ],
})
export class GlobalModule {}
