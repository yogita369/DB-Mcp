import { z } from "zod";
import { getMongoDb } from "../db.js";
import { safeParse } from "../safeParse.js";
import { log } from "../../../logger.js";
export function registerExplainDocument(server) {
    server.tool("mongo_explain", "Explains how MongoDB will execute a query. Shows index usage, documents scanned, execution stats. Does NOT return actual documents.", {
        collection: z
            .string()
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid collection name")
            .describe("Collection name to explain query on"),
        filter: z
            .string()
            .optional()
            .default("{}")
            .describe("JSON filter object e.g. '{\"age\": {\"$gt\": 18}}'"),
        verbosity: z
            .enum(["queryPlanner", "executionStats", "allPlansExecution"])
            .optional()
            .default("executionStats")
            .describe("Level of detail: queryPlanner, executionStats, allPlansExecution"),
    }, async ({ collection, filter, verbosity, }) => {
        try {
            const db = await getMongoDb();
            const col = db.collection(collection);
            const parsedFilter = safeParse(filter ?? "{}");
            const result = await col
                .find(parsedFilter)
                .explain(verbosity);
            // Extract key info for plain language summary
            const queryPlanner = result.queryPlanner;
            const executionStats = result.executionStats;
            const winningPlan = queryPlanner?.winningPlan;
            const inputStage = winningPlan?.inputStage ?? winningPlan;
            const usesIndex = inputStage?.stage === "IXSCAN" ||
                inputStage?.stage === "FETCH" ||
                JSON.stringify(winningPlan).includes("IXSCAN");
            const isCollScan = JSON.stringify(winningPlan).includes("COLLSCAN");
            let risk_level = "MEDIUM";
            let summary = "Query uses a mix of index and collection scanning.";
            if (isCollScan && !usesIndex) {
                risk_level = "HIGH";
                summary = "Query is doing a full collection scan (COLLSCAN). Consider adding an index on the filter fields.";
            }
            else if (usesIndex && !isCollScan) {
                risk_level = "LOW";
                summary = "Query is using an index — efficient execution.";
            }
            const docsExamined = executionStats?.totalDocsExamined ?? "N/A";
            const docsReturned = executionStats?.totalDocsReturned ?? "N/A";
            const executionTimeMs = executionStats?.executionTimeMillis ?? "N/A";
            const indexesUsed = executionStats?.totalKeysExamined ?? "N/A";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            collection,
                            filter: filter ?? "{}",
                            verbosity,
                            note: "This tool only explains the query — it does NOT return documents.",
                            plain_language_summary: summary,
                            risk_level,
                            uses_index: usesIndex,
                            has_collection_scan: isCollScan,
                            stats: {
                                docs_examined: docsExamined,
                                docs_returned: docsReturned,
                                execution_time_ms: executionTimeMs,
                                index_keys_examined: indexesUsed,
                            },
                            winning_plan: winningPlan,
                            full_explain: result,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "mongo_explain failed", { error: err.message, collection });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
