"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const configSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(3001),
    POSTGRES_URL: zod_1.z.string().default('postgres://ims:ims@localhost:5432/ims'),
    MONGODB_URL: zod_1.z.string().default('mongodb://localhost:27017'),
    MONGODB_DB: zod_1.z.string().default('ims'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173')
});
exports.config = configSchema.parse(process.env);
