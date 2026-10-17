import { log } from "./logger.js";
const rateLimitMap = new Map();
const MAX_REQUESTS = 100;
const WINDOW_MS = 60 * 1000; // 60 seconds
export function checkApiKey(req) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        log("warn", "API_KEY not set in environment — rejecting all requests");
        return false;
    }
    const authHeader = req.headers["authorization"];
    if (!authHeader)
        return false;
    return authHeader === `Bearer ${apiKey}`;
}
export function checkRateLimit(apiKey) {
    const now = Date.now();
    const entry = rateLimitMap.get(apiKey);
    if (!entry) {
        rateLimitMap.set(apiKey, { count: 1, windowStart: now });
        return true;
    }
    const elapsed = now - entry.windowStart;
    if (elapsed > WINDOW_MS) {
        // Reset window
        rateLimitMap.set(apiKey, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= MAX_REQUESTS) {
        log("warn", "Rate limit exceeded", { apiKey: apiKey.slice(0, 8) + "***" });
        return false;
    }
    entry.count++;
    return true;
}
