import { z } from "zod";
import { getQueryHistory } from "../../../history.js";
import { log } from "../../../logger.js";
export function registerQueryHistory(server) {
    server.tool("get_query_history", "Returns recent query history from the query log", {
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(20)
            .describe("Maximum number of history rows to return (default 20, max 100)"),
    }, async ({ limit }) => {
        try {
            const rows = getQueryHistory(limit);
            return {
                content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
            };
        }
        catch (error) {
            const err = error;
            log("error", "get_query_history failed", { error: err.message });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
