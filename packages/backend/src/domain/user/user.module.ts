import { Module } from "@nestjs/common";
import { UserController } from "./controller/user.controller.js";
import { UserRepository } from "./repository/user.repository.js";
import { UserService } from "./service/user.service.js";

@Module({
    controllers: [UserController],
    providers: [UserRepository, UserService],
    exports: [UserService],
})
export class UserModule {}
