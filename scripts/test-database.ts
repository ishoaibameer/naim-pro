import "dotenv/config"

import { spawnSync } from "node:child_process"
import postgres from "postgres"

type Action = "setup" | "reset" | "teardown"

function guardedTestDatabaseUrl(): string {
  if (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Test database tooling refuses a production environment.")
  const raw = process.env.TEST_DATABASE_URL
  if (!raw) throw new Error("TEST_DATABASE_URL is required.")
  const url = new URL(raw)
  const databaseName = url.pathname.slice(1).toLowerCase()
  if (!/(?:test|ci)/.test(databaseName))
    throw new Error("TEST_DATABASE_URL database name must contain test or ci.")
  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL === raw &&
    process.env.CI !== "true"
  )
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL.")
  return raw
}

async function clearDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1, prepare: false })
  try {
    const tables = await client<{ tablename: string }[]>`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename <> '__drizzle_migrations'
    `
    if (tables.length) {
      const identifiers = tables
        .map((table) => `"${table.tablename.replaceAll('"', '""')}"`)
        .join(", ")
      await client.unsafe(
        `truncate table ${identifiers} restart identity cascade`
      )
    }
  } finally {
    await client.end()
  }
}

async function main() {
  const action = process.argv[2] as Action | undefined
  if (!action || !["setup", "reset", "teardown"].includes(action))
    throw new Error("Use setup, reset, or teardown.")
  const databaseUrl = guardedTestDatabaseUrl()
  if (action === "setup") {
    const result = spawnSync(
      process.execPath,
      ["node_modules/drizzle-kit/bin.cjs", "migrate"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          APP_ENV: "development",
        },
        shell: false,
      }
    )
    if (result.status !== 0) throw new Error("Test migrations failed.")
  } else {
    await clearDatabase(databaseUrl)
  }
  console.log(`Test database ${action} completed.`)
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Test database action failed."
  )
  process.exitCode = 1
})
