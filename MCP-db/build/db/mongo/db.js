import { MongoClient } from "mongodb";
import { log } from "../../logger.js";
let client;
let db;
export async function getMongoDb() {
    if (db)
        return db;
    const MONGO_URI = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017";
    const MONGO_DB = process.env.MONGO_DB ?? "shopdb";
    log("info", "Connecting to MongoDB", { uri: MONGO_URI, db: MONGO_DB });
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(MONGO_DB);
    log("info", "MongoDB connected", { db: MONGO_DB });
    return db;
}
export async function closeMongoDb() {
    if (client) {
        await client.close();
        client = undefined;
        db = undefined;
        log("info", "MongoDB connection closed");
    }
}
