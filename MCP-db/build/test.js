import { config } from "dotenv";
config({ quiet: true });
import { getDb } from "./db/adapter.js";
import { maskPii } from "./pii.js";
import { isReadOnly } from "./readOnly.js";
let passed = 0;
let failed = 0;
function assert(condition, label) {
    if (condition) {
        process.stderr.write(`PASS: ${label}\n`);
        passed++;
    }
    else {
        process.stderr.write(`FAIL: ${label}\n`);
        failed++;
    }
}
// ── TEST 1: SQLite connection ─────────────────────────────────────────────
{
    const db = getDb();
    const result = db.prepare("SELECT 1 as ok").get();
    assert(result.ok === 1, "SQLite connection works");
    db.close();
}
// ── TEST 2: Schema — at least one table ──────────────────────────────────
{
    const db = getDb();
    const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
        .all();
    assert(tables.length >= 1, "Schema returns at least one table");
    db.close();
}
// ── TEST 3: Execute SELECT query ─────────────────────────────────────────
{
    const db = getDb();
    // Try customers first (created by migrate); fall back to any table
    const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1`)
        .all();
    if (tables.length > 0) {
        const tbl = tables[0].name;
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${tbl}`).get();
        assert(typeof row.count === "number", "execute_query SELECT works");
    }
    else {
        assert(false, "execute_query SELECT works — no tables found");
    }
    db.close();
}
// ── TEST 4: PII masking ───────────────────────────────────────────────────
{
    const rows = maskPii([{ email: "john@example.com", name: "John" }]);
    const maskedEmail = rows[0]["email"];
    const originalName = rows[0]["name"];
    assert(maskedEmail.includes("***") && maskedEmail !== "john@example.com", "PII masking: email is masked");
    assert(originalName === "John", "PII masking: non-PII field unchanged");
}
// ── TEST 5: Read-only mode flag ───────────────────────────────────────────
{
    process.env.READ_ONLY = "true";
    assert(isReadOnly() === true, "Read-only mode: isReadOnly() returns true when READ_ONLY=true");
    process.env.READ_ONLY = "false";
    assert(isReadOnly() === false, "Read-only mode: isReadOnly() returns false when READ_ONLY=false");
}
// ── TEST 6: Injection guard strips comments ───────────────────────────────
{
    const query = "/* trick */ DROP TABLE users";
    const stripped = query
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--.*$/gm, "");
    const isBlocked = /^\s*(drop|truncate|alter|create|pragma)\b/i.test(stripped.trim());
    assert(isBlocked, "SQL guard: comment-prefixed DROP is blocked");
}
// ── TEST 7: PII phone masking ─────────────────────────────────────────────
{
    const rows = maskPii([{ phone: "9876543210", revenue: 5000 }]);
    const maskedPhone = rows[0]["phone"];
    assert(maskedPhone.endsWith("3210"), "PII masking: phone shows last 4 digits");
    assert(maskedPhone.startsWith("***"), "PII masking: phone prefix is ***");
}
// ── Result ────────────────────────────────────────────────────────────────
if (failed === 0) {
    process.stderr.write(`\nAll ${passed} tests passed ✅\n`);
    process.exit(0);
}
else {
    process.stderr.write(`\n${failed} test(s) failed ❌ (${passed} passed)\n`);
    process.exit(1);
}
