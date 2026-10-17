export function isReadOnly() {
    return process.env.READ_ONLY?.trim().toLowerCase() === "true";
}
