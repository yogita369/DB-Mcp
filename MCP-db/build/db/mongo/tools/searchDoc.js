import { z } from "zod";
import { getMongoDb } from "../db.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerSearchDocuments(server) {
    server.tool("mongo_search", "Search documents in a MongoDB collection using a keyword across multiple fields", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name to search"),
        keyword: z.string().describe("Keyword to search for"),
        fields: z
            .array(z.string())
            .describe("Fields to search in e.g. ['name', 'email', 'category']"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(500)
            .optional()
            .default(50)
            .describe("Maximum results (default 50, max 500)"),
    }, async ({ collection, keyword, fields, limit, }) => {
        try {
            const db = await getMongoDb();
            const col = db.collection(collection);
            const filter = {
                $or: fields.map((field) => ({
                    [field]: { $regex: keyword, $options: "i" },
                })),
            };
            const docs = await col
                .find(filter)
                .maxTimeMS(5000)
                .limit(limit)
                .toArray();
            if (docs.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `⚠️ No documents found for keyword '${keyword}' in fields: ${fields.join(", ")}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            collection,
                            keyword,
                            searched_fields: fields,
                            total_results: docs.length,
                            data: shouldMask()
                                ? maskPii(docs)
                                : docs,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_search failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
