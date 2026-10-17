import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerExportQuery(server) {
    server.tool("export_query", "Export query results in CSV or JSON format", {
        query: z.string().describe("SELECT SQL query to export"),
        format: z.enum(["csv", "json"]).optional().default("json"),
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ query, format, db_name, }) => {
        let db;
        try {
            if (!query.trim().toLowerCase().startsWith("select")) {
                throw new Error("❌ Only SELECT queries allowed for export.");
            }
            let rows = [];
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    const result = await pgClient.query(query);
                    rows = result.rows;
                }
                else {
                    db = entry.client;
                    rows = db.prepare(query).all();
                }
            }
            else {
                db = getDb();
                rows = db.prepare(query).all();
            }
            if (rows.length === 0) {
                return { content: [{ type: "text", text: "⚠️ No results to export." }] };
            }
            const outputRows = shouldMask() ? maskPii(rows) : rows;
            let output;
            if (format === "csv") {
                const headers = Object.keys(outputRows[0]);
                const csvRows = outputRows.map((row) => headers.map((h) => {
                    const v = row[h];
                    if (typeof v === "string" && (v.includes(",") || v.includes('"'))) {
                        return `"${v.replace(/"/g, '""')}"`;
                    }
                    return v ?? "";
                }).join(","));
                output = [headers.join(","), ...csvRows].join("\n");
            }
            else {
                output = JSON.stringify(outputRows, null, 2);
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ format, total_rows: rows.length, exported_at: new Date().toISOString(), data: output }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "export_query failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
