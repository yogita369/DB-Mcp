import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerJoinTables(server) {
    server.tool("join_tables", "Join two tables together and return combined results", {
        table1: z.string().describe("Primary table name"),
        table2: z.string().describe("Secondary table name to join"),
        join_column: z.string().describe("Column to join on"),
        join_type: z.enum(["INNER", "LEFT", "RIGHT"]).optional().default("INNER"),
        columns: z.string().optional().default("*"),
        where: z.string().optional(),
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ table1, table2, join_column, join_type, columns, where, db_name, }) => {
        let db;
        try {
            let query = `
          SELECT ${columns}
          FROM ${table1} t1
          ${join_type} JOIN ${table2} t2
          ON t1.${join_column} = t2.${join_column}
          ${where ? `WHERE ${where}` : ""}
        `;
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
                return { content: [{ type: "text", text: "⚠️ Join returned no results." }] };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ join_type, table1, table2, join_column, total_rows: rows.length, data: shouldMask() ? maskPii(rows) : rows }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "join_tables failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
