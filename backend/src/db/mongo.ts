import { MongoClient, Db } from 'mongodb';

let mongoClient: MongoClient | null = null;

export async function createMongoDb(url: string, dbName: string): Promise<Db> {
  if (!mongoClient) {
    mongoClient = new MongoClient(url);
    await mongoClient.connect();
  }
  return mongoClient.db(dbName);
}
