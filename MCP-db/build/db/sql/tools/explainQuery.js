import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { log } from "../../../logger.js";
export function registerExplainQuery(server) {
    server.tool("explain_query", "Explains what a SQL query will do before executing it. Does NOT run the query.", {
        query: z.string().describe("SQL SELECT query to explain"),
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ query, db_name }) => {
        let db;
        try {
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    const result = await pgClient.query(`EXPLAIN ANALYZE ${query}`);
                    const planLines = result.rows.map((r) => Object.values(r)[0]);
                    const planText = planLines.join("\n");
                    const isSeqScan = planText.includes("Seq Scan");
                    const isIndexScan = planText.includes("Index Scan") || planText.includes("Index Only Scan");
                    let risk_level = "MEDIUM";
                    let summary = "Query uses a mix of index and sequential scanning.";
                    if (isSeqScan && !isIndexScan) {
                        risk_level = "HIGH";
                        summary = "Query is doing a sequential scan. Consider adding an index.";
                    }
                    else if (isIndexScan && !isSeqScan) {
                        risk_level = "LOW";
                        summary = "Query uses an index scan — efficient execution.";
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ query, note: "EXPLAIN ANALYZE — query WAS executed to gather stats", risk_level, summary, plan: planText }, null, 2),
                            },
                        ],
                    };
                }
                db = entry.client;
            }
            else {
                db = getDb();
            }
            const rows = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
            const details = rows.map((r) => r.detail);
            const isFullScan = details.some((d) => /\bSCAN\b/i.test(d));
            const isIndex = details.some((d) => /\bUSING.*INDEX\b/i.test(d));
            let risk_level = "MEDIUM";
            let summary = "Mixed index and scan usage.";
            if (isFullScan && !isIndex) {
                risk_level = "HIGH";
                summary = "Full table scan — consider adding an index.";
            }
            else if (isIndex && !isFullScan) {
                risk_level = "LOW";
                summary = "Index scan — efficient.";
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ query, note: "EXPLAIN QUERY PLAN only — query NOT executed", risk_level, summary, raw_plan: rows }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "explain_query failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
