import { z } from "zod";
import { getMongoDb } from "../db.js";
import { safeParse } from "../safeParse.js";
import { isReadOnly } from "../../../readOnly.js";
import { log } from "../../../logger.js";
const READ_ONLY_MESSAGE = "❌ Server is in read-only mode. Write operations are disabled.";
export function registerInsertDocument(server) {
    server.tool("mongo_insert", "Insert one or multiple documents into a MongoDB collection", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name"),
        documents: z
            .string()
            .describe("JSON array of documents to insert e.g. '[{\"name\": \"Alice\"}]'"),
    }, async ({ collection, documents, }) => {
        if (isReadOnly()) {
            return { content: [{ type: "text", text: READ_ONLY_MESSAGE }] };
        }
        try {
            const db = await getMongoDb();
            const col = db.collection(collection);
            const parsed = safeParse(documents);
            const docsArray = Array.isArray(parsed) ? parsed : [parsed];
            const result = await col.insertMany(docsArray);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            message: "✅ Documents inserted successfully",
                            inserted_count: result.insertedCount,
                            inserted_ids: result.insertedIds,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_insert failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
