import { z } from "zod";

export const envSchema = z.object({
    
    NODE_ENV: z.enum([
        "development",
        "test",
        "production"
    ]).default("development"),

    PORT: z.coerce.number(),

    DATABASE_URL: z.string(),

    REDIS_URL: z.string(),

    JWT_SECRET: z.string().min(32)

});