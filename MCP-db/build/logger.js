export function log(level, msg, meta) {
    process.stderr.write(`${JSON.stringify({ level, msg, ts: new Date().toISOString(), ...meta })}\n`);
}
