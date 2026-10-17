import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { logQuery } from "../../../history.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { isReadOnly } from "../../../readOnly.js";
import { log } from "../../../logger.js";
const WRITE_OPERATIONS = ["insert", "update", "delete"];
const BLOCKED_OPERATIONS = ["drop", "truncate", "alter", "create", "pragma"];
const READ_ONLY_MESSAGE = "❌ Server is in read-only mode. Write operations are disabled.";
export function registerExecuteQuery(server) {
    server.tool("execute_query", "Executes a SQL query on the database. Supports SELECT by default. INSERT, UPDATE, DELETE allowed with allow_write flag.", {
        query: z.string().describe("SQL query to execute"),
        allow_write: z
            .boolean()
            .optional()
            .default(false)
            .describe("Set true to allow INSERT, UPDATE, DELETE operations"),
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ query, allow_write, db_name, }) => {
        const start = Date.now();
        let rowCount;
        let success = false;
        let db;
        try {
            if (query.length > 2000) {
                throw new Error("Query is too long. Maximum length is 2000 characters.");
            }
            const stripped = query
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/--.*$/gm, "");
            const isBlocked = /^\s*(drop|truncate|alter|create|pragma)\b/i.test(stripped.trim());
            if (isBlocked) {
                throw new Error(`❌ Operation not allowed. Blocked commands: ${BLOCKED_OPERATIONS.join(", ").toUpperCase()}`);
            }
            const normalizedQuery = stripped.trim().toLowerCase();
            const isWriteOperation = WRITE_OPERATIONS.some((op) => normalizedQuery.startsWith(op));
            if (isWriteOperation && isReadOnly()) {
                return { content: [{ type: "text", text: READ_ONLY_MESSAGE }] };
            }
            if (isWriteOperation && !allow_write) {
                throw new Error("❌ Write operations are disabled. Set allow_write: true to enable.");
            }
            // ── Postgres path ──────────────────────────────────
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "mongo") {
                    throw new Error("❌ Use mongo_find for MongoDB connections.");
                }
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    const result = await pgClient.query(query);
                    const rows = result.rows;
                    rowCount = rows.length;
                    success = true;
                    const data = shouldMask() ? maskPii(rows) : rows;
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ total_rows: rows.length, data }, null, 2),
                            },
                        ],
                    };
                }
                // sqlite from registry
                db = entry.client;
            }
            else {
                db = getDb();
            }
            // ── SQLite path ────────────────────────────────────
            let result;
            if (isWriteOperation) {
                const info = db.prepare(query).run();
                rowCount = info.changes;
                result = {
                    message: "✅ Query executed successfully",
                    rows_affected: info.changes,
                    last_inserted_id: info.lastInsertRowid ?? null,
                };
            }
            else {
                const rows = db.prepare(query).all();
                rowCount = rows.length;
                if (rows.length === 0) {
                    result = { message: "⚠️ Query returned no results." };
                }
                else {
                    const data = shouldMask() ? maskPii(rows) : rows;
                    result =
                        rows.length > 500
                            ? { warning: "Results capped at 500 rows", total_rows: rows.length, data: data.slice(0, 500) }
                            : { total_rows: rows.length, data };
                }
            }
            success = true;
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
        catch (error) {
            const err = error;
            log("error", "execute_query failed", { error: err.message, query });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
        finally {
            logQuery({
                tool_name: "execute_query",
                db_name: db_name ?? process.env.DB_PATH ?? "./database.db",
                query,
                duration_ms: Date.now() - start,
                row_count: rowCount,
                success,
            });
            // only close if it came from getDb() not registry
            if (!db_name)
                db?.close();
        }
    });
}
