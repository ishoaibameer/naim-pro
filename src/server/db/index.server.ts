import "@tanstack/react-start/server-only"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { getServerEnv } from "../env.server"
import * as schema from "./schema"

export type Database = ReturnType<typeof createDatabase>

let database: Database | undefined
let sqlClient: ReturnType<typeof postgres> | undefined

function createDatabase() {
  const env = getServerEnv()
  sqlClient = postgres(env.DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    prepare: false,
  })

  return drizzle(sqlClient, { schema })
}

export function getDatabase(): Database {
  database ??= createDatabase()
  return database
}

export async function closeDatabase(): Promise<void> {
  await sqlClient?.end()
  sqlClient = undefined
  database = undefined
}

export { schema }
