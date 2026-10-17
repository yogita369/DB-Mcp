const BLOCKED_OPERATORS = new Set(["$where", "$function", "$accumulator"]);
function assertSafe(value) {
    if (!value || typeof value !== "object")
        return;
    if (Array.isArray(value)) {
        for (const item of value)
            assertSafe(item);
        return;
    }
    for (const [key, nested] of Object.entries(value)) {
        if (BLOCKED_OPERATORS.has(key)) {
            throw new Error(`❌ Blocked MongoDB operator: '${key}'. This operator is not allowed for security reasons.`);
        }
        assertSafe(nested);
    }
}
export function safeParse(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        throw new Error(`❌ Invalid JSON: ${json}`);
    }
    assertSafe(parsed);
    return parsed;
}
