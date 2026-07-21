"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var dotenv_1 = require("dotenv");
var schema_1 = require("./schema");
dotenv_1.default.config();
var parsed = schema_1.envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Invalid environment variables");
    console.error(parsed.error.format());
    process.exit(1);
}
exports.env = parsed.data;
