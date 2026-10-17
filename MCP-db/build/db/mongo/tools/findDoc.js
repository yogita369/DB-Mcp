import { z } from "zod";
import { getMongoDb } from "../db.js";
import { safeParse } from "../safeParse.js";
import { logQuery } from "../../../history.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerFindDocuments(server) {
    server.tool("mongo_find", "Find documents in a MongoDB collection with optional filter, sort and limit", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name to query"),
        filter: z
            .string()
            .optional()
            .default("{}")
            .describe("JSON filter object e.g. '{\"age\": {\"$gt\": 18}}'"),
        sort: z
            .string()
            .optional()
            .default("{}")
            .describe("JSON sort object e.g. '{\"name\": 1}'"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(10)
            .describe("Maximum documents to return (1–100, default 10)"),
        skip: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
            .describe("Documents to skip for pagination"),
    }, async ({ collection, filter, sort, limit, skip, }) => {
        const start = Date.now();
        let dbName;
        let rowCount;
        let success = false;
        try {
            const db = await getMongoDb();
            dbName = db.databaseName;
            const col = db.collection(collection);
            const parsedFilter = safeParse(filter ?? "{}");
            const parsedSort = safeParse(sort ?? "{}");
            const total = await col.countDocuments(parsedFilter, {
                maxTimeMS: 5000,
            });
            const docs = await col
                .find(parsedFilter)
                .maxTimeMS(5000)
                .sort(parsedSort)
                .skip(skip)
                .limit(limit)
                .toArray();
            rowCount = docs.length;
            success = true;
            if (docs.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚠️ No documents found matching the filter.",
                        },
                    ],
                };
            }
            const responseDocs = shouldMask()
                ? maskPii(docs)
                : docs;
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            collection,
                            total_matching: total,
                            returned: docs.length,
                            skip,
                            limit,
                            data: responseDocs,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_find failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
        finally {
            logQuery({
                tool_name: "mongo_find",
                db_name: dbName,
                query: filter ?? "{}",
                duration_ms: Date.now() - start,
                row_count: rowCount,
                success,
            });
        }
    });
}
