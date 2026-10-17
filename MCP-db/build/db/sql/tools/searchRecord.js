// import { z } from "zod";
// import { getDb } from "../../adapter.js";
// import { maskPii, shouldMask } from "../../../pii.js";
// import { log } from "../../../logger.js";
// export function registerSearchRecords(server: any): void {
//   server.tool(
//     "search_records",
//     "Search across any table and column using a keyword",
//     {
//       table: z.string().describe("Table name to search in"),
//       keyword: z.string().describe("Keyword to search for"),
//       columns: z
//         .array(z.string())
//         .optional()
//         .describe(
//           "Specific columns to search. If omitted, searches all TEXT columns."
//         ),
//       limit: z
//         .number()
//         .int()
//         .min(1)
//         .max(500)
//         .optional()
//         .default(50)
//         .describe("Maximum results to return (default 50, max 500)"),
//     },
//     async ({
//       table,
//       keyword,
//       columns,
//       limit,
//     }: {
//       table: string;
//       keyword: string;
//       columns?: string[];
//       limit: number;
//     }) => {
//       let db: ReturnType<typeof getDb> | undefined;
//       try {
//         db = getDb();
//         const tableExists = db
//           .prepare(
//             `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`
//           )
//           .get(table);
//         if (!tableExists)
//           throw new Error(`❌ Table '${table}' does not exist.`);
//         let searchColumns = columns;
//         if (!searchColumns || searchColumns.length === 0) {
//           const tableInfo = db
//             .prepare(`PRAGMA table_info(${table})`)
//             .all() as { name: string; type: string }[];
//           searchColumns = tableInfo
//             .filter(
//               (col) =>
//                 col.type.toUpperCase() === "TEXT" || col.type === ""
//             )
//             .map((col) => col.name);
//           if (searchColumns.length === 0) {
//             throw new Error(
//               `❌ No searchable TEXT columns found in '${table}'.`
//             );
//           }
//         }
//         const whereClause = searchColumns
//           .map((col) => `${col} LIKE ?`)
//           .join(" OR ");
//         const searchValues = searchColumns.map(() => `%${keyword}%`);
//         const query = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT ${limit}`;
//         const rows = db
//           .prepare(query)
//           .all(...searchValues) as Record<string, unknown>[];
//         if (rows.length === 0) {
//           return {
//             content: [
//               {
//                 type: "text",
//                 text: `⚠️ No results found for keyword '${keyword}' in table '${table}'.`,
//               },
//             ],
//           };
//         }
//         return {
//           content: [
//             {
//               type: "text",
//               text: JSON.stringify(
//                 {
//                   table,
//                   keyword,
//                   searched_columns: searchColumns,
//                   total_results: rows.length,
//                   data: shouldMask() ? maskPii(rows) : rows,
//                 },
//                 null,
//                 2
//               ),
//             },
//           ],
//         };
//       } catch (error: unknown) {
//         const err = error as Error;
//         log("error", "search_records failed", { error: err.message });
//         return {
//           content: [{ type: "text", text: `❌ Error: ${err.message}` }],
//         };
//       } finally {
//         db?.close();
//       }
//     }
//   );
// }
import { z } from "zod";
import { getDb } from "../../adapter.js";
import { getConnection } from "../../registry.js";
import { maskPii, shouldMask } from "../../../pii.js";
import { log } from "../../../logger.js";
export function registerSearchRecords(server) {
    server.tool("search_records", "Search across any table and column using a keyword", {
        table: z.string().describe("Table name to search in"),
        keyword: z.string().describe("Keyword to search for"),
        columns: z.array(z.string()).optional().describe("Columns to search. If omitted searches all text columns."),
        limit: z.number().int().min(1).max(500).optional().default(50),
        db_name: z
            .string()
            .optional()
            .describe("Named connection from connect_database. If omitted uses default SQLite."),
    }, async ({ table, keyword, columns, limit, db_name, }) => {
        let db;
        try {
            if (db_name) {
                const entry = getConnection(db_name);
                if (entry.type === "postgres") {
                    const pgClient = entry.client;
                    let searchColumns = columns;
                    if (!searchColumns || searchColumns.length === 0) {
                        const colResult = await pgClient.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = $1 AND table_schema = 'public'
                AND data_type IN ('text','character varying','varchar','char','name')
              `, [table]);
                        searchColumns = colResult.rows.map((r) => r.column_name);
                        if (searchColumns.length === 0) {
                            throw new Error(`❌ No searchable text columns in '${table}'.`);
                        }
                    }
                    const whereClause = searchColumns
                        .map((col, i) => `"${col}"::text ILIKE $${i + 1}`)
                        .join(" OR ");
                    const values = searchColumns.map(() => `%${keyword}%`);
                    const result = await pgClient.query(`SELECT * FROM "${table}" WHERE ${whereClause} LIMIT ${limit}`, values);
                    const rows = result.rows;
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    table, keyword,
                                    searched_columns: searchColumns,
                                    total_results: rows.length,
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
            const tableInfo = db
                .prepare(`PRAGMA table_info(${table})`)
                .all();
            const searchColumns = columns && columns.length > 0
                ? columns
                : tableInfo
                    .filter((col) => col.type.toUpperCase() === "TEXT" || col.type === "")
                    .map((col) => col.name);
            if (searchColumns.length === 0) {
                throw new Error(`❌ No searchable TEXT columns in '${table}'.`);
            }
            const whereClause = searchColumns.map((col) => `${col} LIKE ?`).join(" OR ");
            const values = searchColumns.map(() => `%${keyword}%`);
            const rows = db
                .prepare(`SELECT * FROM ${table} WHERE ${whereClause} LIMIT ${limit}`)
                .all(...values);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ table, keyword, searched_columns: searchColumns, total_results: rows.length, data: shouldMask() ? maskPii(rows) : rows }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            log("error", "search_records failed", { error: err.message });
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
        finally {
            if (!db_name)
                db?.close();
        }
    });
}
