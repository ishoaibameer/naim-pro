import "dotenv/config"
import { defineConfig } from "drizzle-kit"
import { z } from "zod"

const databaseUrl = process.env.DATABASE_URL
const dbCredentials = databaseUrl
  ? {
      url: z
        .url({ error: "DATABASE_URL must be a valid PostgreSQL URL" })
        .parse(databaseUrl),
    }
  : undefined

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials,
})
