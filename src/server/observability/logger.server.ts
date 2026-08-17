import "@tanstack/react-start/server-only"

import { getServerEnv } from "@/server/env.server"

type LogLevel = "debug" | "info" | "warn" | "error"
type LogMetadata = Record<string, unknown>

const order: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}
const sensitiveKey =
  /password|secret|token|authorization|cookie|database_url|access_key|hash/i
const secretValue =
  /(postgres(?:ql)?:\/\/[^\s:@]+:)[^\s@]+@|\b(?:npg_|AKIA)[A-Za-z0-9_-]+|\$argon2(?:id|i|d)\$/gi

export function redactLogValue(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]"
  if (typeof value === "string")
    return value.replace(secretValue, "$1[REDACTED]@")
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ])
    )
  return value
}

function write(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const env = getServerEnv()
  if (order[level] < order[env.LOG_LEVEL]) return
  const payload = JSON.stringify(
    redactLogValue({
      timestamp: new Date().toISOString(),
      level,
      event,
      environment: env.APP_ENV,
      ...metadata,
    })
  )
  if (level === "error") console.error(payload)
  else if (level === "warn") console.warn(payload)
  else console.log(payload)
}

export const logger = {
  debug: (event: string, metadata?: LogMetadata) =>
    write("debug", event, metadata),
  info: (event: string, metadata?: LogMetadata) =>
    write("info", event, metadata),
  warn: (event: string, metadata?: LogMetadata) =>
    write("warn", event, metadata),
  error: (event: string, metadata?: LogMetadata) =>
    write("error", event, metadata),
}
