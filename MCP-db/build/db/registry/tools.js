import { z } from "zod";
import { connectDatabase, listConnections, disconnectDatabase, } from "../registry.js";
import { log } from "../../logger.js";
export function registerRegistryTools(server) {
    server.tool("connect_database", "Connect to any database at runtime. Drop a file path for SQLite, postgres:// URL for PostgreSQL, or mongodb:// URI for MongoDB.", {
        name: z
            .string()
            .describe("Nickname for this connection e.g. 'mydb' or 'prod'"),
        connection_string: z
            .string()
            .describe("SQLite: ./data.db | Postgres: postgres://user:pass@host:5432/db | Mongo: mongodb://host:27017/db"),
    }, async ({ name, connection_string, }) => {
        try {
            const result = await connectDatabase(name, connection_string);
            return { content: [{ type: "text", text: result }] };
        }
        catch (error) {
            const err = error;
            log("error", "connect_database failed", { error: err.message });
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
    server.tool("list_connections", "List all currently connected databases.", {}, async () => {
        try {
            const connections = listConnections();
            if (connections.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚠️ No databases connected. Use connect_database first.",
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ total: connections.length, connections }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const err = error;
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
    server.tool("disconnect_database", "Disconnect a named database.", {
        name: z.string().describe("Name of the connection to disconnect"),
    }, async ({ name }) => {
        try {
            const result = await disconnectDatabase(name);
            return { content: [{ type: "text", text: result }] };
        }
        catch (error) {
            const err = error;
            return {
                content: [{ type: "text", text: `❌ Error: ${err.message}` }],
            };
        }
    });
}
