import Database from "better-sqlite3";
import { log } from "./logger.js";
const HISTORY_DB_PATH = process.env.HISTORY_DB_PATH ?? "./history.db";
const historyDb = new Database(HISTORY_DB_PATH, { timeout: 5000 });
historyDb
    .prepare(`CREATE TABLE IF NOT EXISTS query_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_name   TEXT    NOT NULL,
      db_name     TEXT,
      query       TEXT,
      timestamp   TEXT    DEFAULT (datetime('now')),
      duration_ms INTEGER,
      row_count   INTEGER,
      success     INTEGER DEFAULT 1
    )`)
    .run();
log("info", "History DB ready", { path: HISTORY_DB_PATH });
export function logQuery(entry) {
    try {
        historyDb
            .prepare(`INSERT INTO query_log
           (tool_name, db_name, query, duration_ms, row_count, success)
         VALUES (?, ?, ?, ?, ?, ?)`)
            .run(entry.tool_name, entry.db_name ?? null, entry.query ?? null, entry.duration_ms ?? null, entry.row_count ?? null, entry.success === undefined ? 1 : Number(entry.success));
    }
    catch (err) {
        log("error", "Failed to write query history", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
export function getQueryHistory(limit) {
    return historyDb
        .prepare(`SELECT id, tool_name, db_name, query, timestamp, duration_ms, row_count, success
       FROM query_log
       ORDER BY id DESC
       LIMIT ?`)
        .all(limit);
}
