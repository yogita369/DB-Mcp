import { z } from "zod";
import { getMongoDb } from "../db.js";
import { safeParse } from "../safeParse.js";
import { isReadOnly } from "../../../readOnly.js";
import { log } from "../../../logger.js";
const READ_ONLY_MESSAGE = "❌ Server is in read-only mode. Write operations are disabled.";
export function registerUpdateDocument(server) {
    server.tool("mongo_update", "Update one or many documents in a MongoDB collection", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name"),
        filter: z
            .string()
            .describe("JSON filter to find documents e.g. '{\"name\": \"Alice\"}'"),
        update: z
            .string()
            .describe("JSON update object e.g. '{\"$set\": {\"age\": 30}}'"),
        update_many: z
            .boolean()
            .optional()
            .default(false)
            .describe("Set true to update all matching documents. Default updates only the first match."),
    }, async ({ collection, filter, update, update_many, }) => {
        if (isReadOnly()) {
            return { content: [{ type: "text", text: READ_ONLY_MESSAGE }] };
        }
        try {
            const db = await getMongoDb();
            const col = db.collection(collection);
            const parsedFilter = safeParse(filter);
            const parsedUpdate = safeParse(update);
            const result = update_many
                ? await col.updateMany(parsedFilter, parsedUpdate)
                : await col.updateOne(parsedFilter, parsedUpdate);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            message: "✅ Update successful",
                            matched_count: result.matchedCount,
                            modified_count: result.modifiedCount,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_update failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
