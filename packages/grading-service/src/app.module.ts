import { Module } from "@nestjs/common";
import { GradingController } from "./grading.controller.js";
import { GradingService } from "./grading.service.js";

@Module({
    controllers: [GradingController],
    providers: [GradingService],
})
export class AppModule {}
