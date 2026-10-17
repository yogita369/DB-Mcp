import { log } from "../logger.js";
import { saveProfiles, loadProfiles } from "./profiles.js";
const registry = new Map();
export async function connectDatabase(name, connectionString) {
    let type;
    if (connectionString.startsWith("postgres://") ||
        connectionString.startsWith("postgresql://")) {
        type = "postgres";
    }
    else if (connectionString.startsWith("mongodb://") ||
        connectionString.startsWith("mongodb+srv://")) {
        type = "mongo";
    }
    else {
        type = "sqlite";
    }
    if (registry.has(name)) {
        await disconnectDatabase(name);
    }
    let client;
    if (type === "sqlite") {
        const Database = (await import("better-sqlite3")).default;
        client = new Database(connectionString, { timeout: 5000 });
        log("info", `Connected sqlite as '${name}'`, { connectionString });
    }
    else if (type === "postgres") {
        const { Client } = await import("pg");
        const pgClient = new Client({ connectionString });
        await pgClient.connect();
        client = pgClient;
        log("info", `Connected postgres as '${name}'`, { connectionString });
    }
    else if (type === "mongo") {
        const { MongoClient } = await import("mongodb");
        const mongoClient = new MongoClient(connectionString, {
            serverSelectionTimeoutMS: 5000,
        });
        await mongoClient.connect();
        client = mongoClient;
        log("info", `Connected mongo as '${name}'`, { connectionString });
    }
    saveProfiles(new Map(Array.from(registry.entries()).map(([n, e]) => [n, { type: e.type, connectionString: e.connectionString }])));
    registry.set(name, { type, connectionString, client });
    return `✅ Connected ${type} as '${name}'`;
}
export function getConnection(name) {
    const entry = registry.get(name);
    if (!entry) {
        throw new Error(`❌ No database connected with name '${name}'. Use connect_database first.`);
    }
    return entry;
}
export function listConnections() {
    return Array.from(registry.entries()).map(([name, entry]) => ({
        name,
        type: entry.type,
        connectionString: entry.type === "sqlite"
            ? entry.connectionString
            : entry.connectionString.replace(/:\/\/[^@]+@/, "://***@"),
    }));
}
export async function disconnectDatabase(name) {
    const entry = registry.get(name);
    if (!entry) {
        throw new Error(`❌ No connection named '${name}' found.`);
    }
    if (entry.type === "sqlite") {
        const Database = (await import("better-sqlite3")).default;
        entry.client.close();
    }
    else if (entry.type === "postgres") {
        const { Client } = await import("pg");
        await entry.client.end();
    }
    else if (entry.type === "mongo") {
        await entry.client.close();
    }
    registry.delete(name);
    log("info", `Disconnected '${name}'`);
    saveProfiles(new Map(Array.from(registry.entries()).map(([n, e]) => [n, { type: e.type, connectionString: e.connectionString }])));
    return `✅ Disconnected '${name}'`;
}
export async function disconnectAll() {
    for (const name of registry.keys()) {
        try {
            await disconnectDatabase(name);
        }
        catch (err) {
            log("error", `Failed to disconnect '${name}'`, {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}
export async function loadSavedProfiles() {
    const profiles = loadProfiles();
    if (profiles.length === 0)
        return;
    log("info", "Restoring saved profiles", { count: profiles.length });
    for (const profile of profiles) {
        try {
            await connectDatabase(profile.name, profile.connectionString);
            log("info", `Restored connection '${profile.name}'`);
        }
        catch (err) {
            log("warn", `Failed to restore '${profile.name}' — skipping`, {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}
