import { z } from "zod";
import { getMongoDb } from "../db.js";
import { safeParse } from "../safeParse.js";
import { isReadOnly } from "../../../readOnly.js";
import { log } from "../../../logger.js";
const READ_ONLY_MESSAGE = "❌ Server is in read-only mode. Write operations are disabled.";
export function registerDeleteDocument(server) {
    server.tool("mongo_delete", "Delete one or many documents from a MongoDB collection", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name"),
        filter: z
            .string()
            .describe("JSON filter to find documents e.g. '{\"name\": \"Alice\"}'"),
        delete_many: z
            .boolean()
            .optional()
            .default(false)
            .describe("Set true to delete all matching documents. Default deletes only the first match."),
    }, async ({ collection, filter, delete_many, }) => {
        if (isReadOnly()) {
            return { content: [{ type: "text", text: READ_ONLY_MESSAGE }] };
        }
        try {
            const db = await getMongoDb();
            const col = db.collection(collection);
            const parsedFilter = safeParse(filter);
            const result = delete_many
                ? await col.deleteMany(parsedFilter)
                : await col.deleteOne(parsedFilter);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            message: "✅ Delete successful",
                            deleted_count: result.deletedCount,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_delete failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
