import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import type { DB } from "../db/index.js";

declare module "fastify" {
    interface FastifyInstance {
        db: DB;
    }
}

const dbPlugin: FastifyPluginAsync = async (app) => {
    app.decorate("db", db);
};

export default fp(dbPlugin, { name: "db" });
