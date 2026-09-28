type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

// JSON-line output, not prefixed strings - this is what "structured"
// buys you: a log aggregator (Vercel logs, or whatever this ends up
// running on) can filter/query by field instead of grepping messages.
function log(level: LogLevel, message: string, fields?: LogFields) {
  const line = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
};
