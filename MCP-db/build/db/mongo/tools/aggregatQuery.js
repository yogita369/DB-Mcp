import { z } from "zod";
import { getMongoDb } from "../db.js";
import { safeParse } from "../safeParse.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerAggregateQuery(server) {
    server.tool("mongo_aggregate", "Run an aggregation pipeline on a MongoDB collection", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name to query"),
        pipeline: z
            .string()
            .describe('JSON array of aggregation stages e.g. \'[{"$group": {"_id": "$category", "total": {"$sum": "$price"}}}]\''),
    }, async ({ collection, pipeline, }) => {
        try {
            const db = await getMongoDb();
            const col = db.collection(collection);
            const parsedPipeline = safeParse(pipeline);
            const result = await col
                .aggregate(parsedPipeline)
                .maxTimeMS(5000)
                .toArray();
            if (result.length === 0) {
                return {
                    content: [
                        { type: "text", text: "⚠️ Aggregation returned no results." },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            total_results: result.length,
                            data: shouldMask()
                                ? maskPii(result)
                                : result,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_aggregate failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
