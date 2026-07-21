"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
var zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum([
        "development",
        "test",
        "production"
    ]).default("development"),
    PORT: zod_1.z.coerce.number(),
    DATABASE_URL: zod_1.z.string(),
    REDIS_URL: zod_1.z.string(),
    JWT_SECRET: zod_1.z.string().min(32)
});
