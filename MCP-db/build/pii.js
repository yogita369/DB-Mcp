const PII_KEYWORDS = [
    "email", "phone", "mobile", "ssn", "password",
    "secret", "token", "card", "cvv", "dob",
];
export function shouldMask() {
    return process.env.MASK_PII?.trim().toLowerCase() === "true";
}
export function maskPii(rows) {
    return rows.map((row) => {
        const maskedRow = {};
        for (const [column, value] of Object.entries(row)) {
            maskedRow[column] = maskValue(column, value);
        }
        return maskedRow;
    });
}
function maskValue(column, value) {
    const normalizedColumn = column.toLowerCase();
    const keyword = PII_KEYWORDS.find((item) => normalizedColumn.includes(item));
    if (!keyword)
        return value;
    if (keyword === "email")
        return maskEmail(value);
    if (keyword === "phone" || keyword === "mobile")
        return maskPhone(value);
    return "***MASKED***";
}
function maskEmail(value) {
    if (typeof value !== "string")
        return "***MASKED***";
    const [localPart] = value.split("@");
    const firstChar = localPart?.[0] ?? "*";
    return `${firstChar}***@***.com`;
}
function maskPhone(value) {
    if (typeof value !== "string")
        return "***-***-XXXX";
    const digits = value.replace(/\D/g, "");
    const lastFour = digits.length >= 4 ? digits.slice(-4) : "XXXX";
    return `***-***-${lastFour}`;
}
