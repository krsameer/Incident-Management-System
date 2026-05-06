"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMongoDb = createMongoDb;
const mongodb_1 = require("mongodb");
let mongoClient = null;
async function createMongoDb(url, dbName) {
    if (!mongoClient) {
        mongoClient = new mongodb_1.MongoClient(url);
        await mongoClient.connect();
    }
    return mongoClient.db(dbName);
}
