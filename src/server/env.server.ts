import "@tanstack/react-start/server-only"

import { z } from "zod"

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .url("DATABASE_URL must be a valid URL")
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use the postgresql:// or postgres:// scheme"
    ),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must contain at least 32 characters"),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)

  if (!result.success) {
    const variables = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ")

    throw new Error(
      `Invalid server environment${variables ? `: ${variables}` : ""}`
    )
  }

  return result.data
}
