"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisClient = createRedisClient;
const redis_1 = require("redis");
function createRedisClient(redisUrl) {
    return (0, redis_1.createClient)({ url: redisUrl });
}
