import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { log } from "../../../logger.js";
export function registerListTables(server) {
    server.tool("list_tables", "Returns all table names in the database", {
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ db_name }) => {
        let db;
        try {
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    const result = await pgClient.query(`
              SELECT table_name as name
              FROM information_schema.tables
              WHERE table_schema = 'public'
              ORDER BY table_name
            `);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    total_tables: result.rows.length,
                                    tables: result.rows.map((r) => r.name),
                                }, null, 2),
                            },
                        ],
                    };
                }
                db = entry.client;
            }
            else {
                db = getDb();
            }
            const tables = db
                .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
                .all();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ total_tables: tables.length, tables: tables.map((t) => t.name) }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "list_tables failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
