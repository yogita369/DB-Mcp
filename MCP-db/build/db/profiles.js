import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { log } from "../logger.js";
const PROFILES_PATH = process.env.PROFILES_PATH ?? "./profiles.json";
const PROFILES_KEY = process.env.PROFILES_KEY ?? "";
// Key must be exactly 32 bytes for AES-256
function getKey() {
    if (!PROFILES_KEY || PROFILES_KEY.length < 32) {
        return null;
    }
    return Buffer.from(PROFILES_KEY.slice(0, 32), "utf8");
}
export function saveProfiles(registry) {
    const key = getKey();
    if (!key) {
        log("warn", "PROFILES_KEY not set or too short — persistence disabled");
        return;
    }
    try {
        const profiles = Array.from(registry.entries()).map(([name, entry]) => ({
            name,
            type: entry.type,
            connectionString: entry.connectionString,
        }));
        const plaintext = JSON.stringify(profiles);
        const iv = randomBytes(12); // 12 bytes for GCM
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, "utf8"),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();
        // Store: iv + authTag + encrypted — all as hex
        const payload = JSON.stringify({
            iv: iv.toString("hex"),
            tag: authTag.toString("hex"),
            data: encrypted.toString("hex"),
        });
        writeFileSync(PROFILES_PATH, payload, "utf8");
        log("info", "Profiles saved", { count: profiles.length, path: PROFILES_PATH });
    }
    catch (err) {
        log("error", "Failed to save profiles", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
export function loadProfiles() {
    const key = getKey();
    if (!key) {
        return [];
    }
    try {
        const raw = readFileSync(PROFILES_PATH, "utf8");
        const payload = JSON.parse(raw);
        const iv = Buffer.from(payload.iv, "hex");
        const authTag = Buffer.from(payload.tag, "hex");
        const encrypted = Buffer.from(payload.data, "hex");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = decipher.update(encrypted) + decipher.final("utf8");
        const profiles = JSON.parse(decrypted);
        log("info", "Profiles loaded", { count: profiles.length });
        return profiles;
    }
    catch (err) {
        // File missing or decryption failed — not an error, just return empty
        log("info", "No saved profiles found or decryption failed — starting fresh");
        return [];
    }
}
