// import { dirname, resolve } from "path";
// import { fileURLToPath } from "url";
// import { loadSavedProfiles } from "./db/registry.js";
// import { config } from "dotenv";
// const currentDir = dirname(fileURLToPath(import.meta.url));
// if (process.env.NODE_ENV !== "production") {
//   config({ path: resolve(currentDir, "../.env"), quiet: true });
// }
// import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { registerSqlTools } from "./db/sql/tools/index.js";
// import { registerMongoTools } from "./db/mongo/tools/index.js";
// import { registerRegistryTools } from "./db/registry/tools.js";
// import { closeMongoDb } from "./db/mongo/db.js";
// import { disconnectAll } from "./db/registry.js";
// import { log } from "./logger.js";
// const server = new McpServer({
//   name: "db-mcp-server",
//   version: "1.0.0",
// });
// registerSqlTools(server);
// registerMongoTools(server);
// registerRegistryTools(server);
// async function main(): Promise<void> {
//   const transport = new StdioServerTransport();
//   await server.connect(transport);
//   await loadSavedProfiles();
//   log("info", "MCP server started", { transport: "stdio" });
// }
// async function shutdown(): Promise<void> {
//   log("info", "Shutting down MCP server");
//   await disconnectAll();
//   await closeMongoDb();
//   process.exit(0);
// }
// process.on("SIGINT", shutdown);
// process.on("SIGTERM", shutdown);
// main().catch((error) => {
//   process.stderr.write(
//     JSON.stringify({
//       level: "error",
//       msg: "Fatal error in main",
//       error:
//         error instanceof Error ? error.stack ?? error.message : String(error),
//       ts: new Date().toISOString(),
//     }) + "\n"
//   );
//   process.exit(1);
// });
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
if (process.env.NODE_ENV !== "production") {
    const { config } = await import("dotenv");
    const currentDir = dirname(fileURLToPath(import.meta.url));
    config({ path: resolve(currentDir, "../.env"), quiet: true });
}
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { registerSqlTools } from "./db/sql/tools/index.js";
import { registerMongoTools } from "./db/mongo/tools/index.js";
import { registerRegistryTools } from "./db/registry/tools.js";
import { closeMongoDb } from "./db/mongo/db.js";
import { disconnectAll, loadSavedProfiles } from "./db/registry.js";
import { checkApiKey, checkRateLimit } from "./auth.js";
import { log } from "./logger.js";
const server = new McpServer({
    name: "db-mcp-server",
    version: "1.0.0",
});
registerSqlTools(server);
registerMongoTools(server);
registerRegistryTools(server);
async function main() {
    const transport_mode = process.env.TRANSPORT ?? "stdio";
    if (transport_mode === "http") {
        const port = Number(process.env.PORT) || 3000;
        const httpServer = createServer(async (req, res) => {
            // Health check — no auth needed
            if (req.method === "GET" && req.url === "/health") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    status: "ok",
                    transport: "http",
                    uptime: process.uptime(),
                }));
                return;
            }
            // Check API key
            if (!checkApiKey(req)) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }
            // Check rate limit
            const apiKey = process.env.API_KEY ?? "";
            if (!checkRateLimit(apiKey)) {
                res.writeHead(429, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Too many requests" }));
                return;
            }
            // Forward to MCP transport
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            await server.connect(transport);
            await transport.handleRequest(req, res);
        });
        httpServer.listen(port, () => {
            log("info", "MCP HTTP server started", { port });
        });
    }
    else {
        // Default stdio mode — unchanged
        const transport = new StdioServerTransport();
        await server.connect(transport);
        await loadSavedProfiles();
        log("info", "MCP server started", { transport: "stdio" });
    }
}
async function shutdown() {
    log("info", "Shutting down MCP server");
    await disconnectAll();
    await closeMongoDb();
    process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch((error) => {
    process.stderr.write(JSON.stringify({
        level: "error",
        msg: "Fatal error in main",
        error: error instanceof Error ? error.stack ?? error.message : String(error),
        ts: new Date().toISOString(),
    }) + "\n");
    process.exit(1);
});
