import { getMongoDb } from "../db.js";
import { log } from "../../../logger.js";
export function registerListCollections(server) {
    server.tool("mongo_list_collections", "List all collections in the MongoDB database", {}, async () => {
        try {
            const db = await getMongoDb();
            const cols = await db.listCollections().toArray();
            if (cols.length === 0) {
                return {
                    content: [
                        { type: "text", text: "⚠️ No collections found in the database." },
                    ],
                };
            }
            const result = await Promise.all(cols.map(async (col) => ({
                name: col.name,
                type: col.type,
                total_documents: await db
                    .collection(col.name)
                    .countDocuments({}, { maxTimeMS: 5000 }),
            })));
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ total_collections: result.length, collections: result }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_list_collections failed", { error: err.message });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
