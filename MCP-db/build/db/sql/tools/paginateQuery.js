import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerPaginateQuery(server) {
    server.tool("paginate_query", "Executes a SELECT query with pagination support", {
        query: z.string().describe("SELECT SQL query to paginate"),
        page: z.number().int().min(1).optional().default(1),
        page_size: z.number().int().min(1).max(500).optional().default(10),
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ query, page, page_size, db_name, }) => {
        let db;
        try {
            if (!query.trim().toLowerCase().startsWith("select")) {
                throw new Error("❌ Only SELECT queries allowed.");
            }
            const offset = (page - 1) * page_size;
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    const countResult = await pgClient.query(`SELECT COUNT(*) as count FROM (${query}) sub`);
                    const count = Number(countResult.rows[0].count);
                    const dataResult = await pgClient.query(`${query} LIMIT $1 OFFSET $2`, [page_size, offset]);
                    const rows = dataResult.rows;
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    total_rows: count,
                                    total_pages: Math.ceil(count / page_size),
                                    current_page: page,
                                    page_size,
                                    data: shouldMask() ? maskPii(rows) : rows,
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
            const { count } = db
                .prepare(`SELECT COUNT(*) as count FROM (${query})`)
                .get();
            const rows = db
                .prepare(`${query} LIMIT ${page_size} OFFSET ${offset}`)
                .all();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            total_rows: count,
                            total_pages: Math.ceil(count / page_size),
                            current_page: page,
                            page_size,
                            data: shouldMask() ? maskPii(rows) : rows,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "paginate_query failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
