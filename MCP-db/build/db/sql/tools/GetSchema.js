import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { log } from "../../../logger.js";
import { z } from "zod";
export function registerGetSchema(server) {
    server.tool("get_schema", "Returns full database schema with all tables, columns, types and constraints", {
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ db_name }) => {
        let db;
        try {
            // ── Postgres path ────────────────────────────────
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    const tablesResult = await pgClient.query(`
              SELECT table_name
              FROM information_schema.tables
              WHERE table_schema = 'public'
              ORDER BY table_name
            `);
                    if (tablesResult.rows.length === 0) {
                        return { content: [{ type: "text", text: "⚠️ No tables found." }] };
                    }
                    const schema = await Promise.all(tablesResult.rows.map(async (t) => {
                        const colResult = await pgClient.query(`
                  SELECT column_name, data_type, is_nullable, column_default
                  FROM information_schema.columns
                  WHERE table_name = $1 AND table_schema = 'public'
                  ORDER BY ordinal_position
                `, [t.table_name]);
                        const countResult = await pgClient.query(`SELECT COUNT(*) as count FROM "${t.table_name}"`);
                        return {
                            table: t.table_name,
                            total_rows: Number(countResult.rows[0].count),
                            columns: colResult.rows.map((col) => ({
                                name: col.column_name,
                                type: col.data_type,
                                nullable: col.is_nullable === "YES",
                                default_value: col.column_default ?? null,
                            })),
                        };
                    }));
                    return {
                        content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
                    };
                }
                // sqlite from registry
                db = entry.client;
            }
            else {
                db = getDb();
            }
            // ── SQLite path ──────────────────────────────────
            const tables = db
                .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
                .all();
            if (tables.length === 0) {
                return { content: [{ type: "text", text: "⚠️ No tables found." }] };
            }
            const schema = tables.map((table) => {
                const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
                const rowCount = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
                return {
                    table: table.name,
                    total_rows: rowCount,
                    columns: columns.map((col) => ({
                        name: col.name,
                        type: col.type,
                        primary_key: col.pk === 1,
                        nullable: col.notnull === 0,
                        default_value: col.dflt_value ?? null,
                    })),
                };
            });
            return {
                content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
            };
        }
        catch (error) {
            const err = error;
            log("error", "get_schema failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
