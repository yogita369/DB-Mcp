import Database from "better-sqlite3";
import path from "path";
export function getDb() {
    const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "database.db");
    const DB_TYPE = process.env.DB_TYPE ?? "sqlite";
    switch (DB_TYPE) {
        case "sqlite":
            return new Database(DB_PATH, { timeout: 5000 });
        default:
            throw new Error(`❌ Unsupported DB_TYPE: "${DB_TYPE}". Use "sqlite".`);
    }
}
