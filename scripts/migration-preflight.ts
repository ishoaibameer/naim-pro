import "dotenv/config"

import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"

function validateMigrationSequence() {
  const names = readdirSync("drizzle")
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
  for (const [index, name] of names.entries()) {
    const expected = String(index).padStart(4, "0")
    if (!name.startsWith(`${expected}_`))
      throw new Error(`Migration sequence is not contiguous at ${name}.`)
  }
}

function validateEnvironment() {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error("DATABASE_URL is required for migration preflight.")
  const url = new URL(raw)
  if (process.env.APP_ENV !== "development") {
    const sslMode = url.searchParams.get("sslmode")
    if (!sslMode || !["require", "verify-ca", "verify-full"].includes(sslMode))
      throw new Error(
        "Non-development migrations require encrypted PostgreSQL."
      )
  }
}

validateMigrationSequence()
validateEnvironment()
const result = spawnSync(
  process.execPath,
  ["node_modules/drizzle-kit/bin.cjs", "check"],
  {
    stdio: "inherit",
    shell: false,
  }
)
if (result.status !== 0) process.exitCode = result.status ?? 1
else console.log("Migration preflight passed.")
