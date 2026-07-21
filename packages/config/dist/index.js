"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const env_1 = require("./env");
exports.config = {
    nodeEnv: env_1.env.NODE_ENV,
    port: env_1.env.PORT,
    databaseUrl: env_1.env.DATABASE_URL,
    redisUrl: env_1.env.REDIS_URL,
    jwtSecret: env_1.env.JWT_SECRET
};
//# sourceMappingURL=index.js.map