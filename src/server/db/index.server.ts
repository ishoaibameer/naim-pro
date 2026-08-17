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
    max: env.DATABASE_MAX_CONNECTIONS,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
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

export async function checkDatabaseReadiness(): Promise<void> {
  const client = sqlClient ?? (getDatabase(), sqlClient)
  if (!client) throw new Error("Database client unavailable.")
  await client`select 1`
}

export { schema }
