import "@tanstack/react-start/server-only"

import { z } from "zod"

const serverEnvSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "staging", "production"])
      .default("development"),
    APP_ORIGIN: z.url().optional(),
    DATABASE_URL: z
      .url("DATABASE_URL must be a valid URL")
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must use the postgresql:// or postgres:// scheme"
      ),
    SESSION_SECRET: z
      .string()
      .min(48, "SESSION_SECRET must contain at least 48 characters"),
    DATABASE_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(20).default(5),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    SLOW_QUERY_THRESHOLD_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(1_000),
    TRUSTED_PROXY_MODE: z
      .enum(["NONE", "CLOUDFLARE", "X_FORWARDED_FOR", "X_REAL_IP"])
      .default("NONE"),
    DOCUMENT_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    DOCUMENT_STORAGE_ROOT: z.string().trim().min(1).optional(),
    DOCUMENT_STORAGE_BUCKET: z.string().trim().min(1).optional(),
    DOCUMENT_STORAGE_ENDPOINT: z.url().optional(),
    DOCUMENT_STORAGE_REGION: z.string().trim().min(1).optional(),
    DOCUMENT_STORAGE_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    DOCUMENT_STORAGE_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    DOCUMENT_STORAGE_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    ALLOW_UNSAFE_LOCAL_DOCUMENT_STORAGE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DOCUMENT_MALWARE_SCAN_POLICY: z
      .enum(["DISABLED", "REQUIRED"])
      .default("DISABLED"),
  })
  .superRefine((env, context) => {
    if (env.APP_ENV !== "development") {
      if (!env.APP_ORIGIN)
        context.addIssue({
          code: "custom",
          path: ["APP_ORIGIN"],
          message: "APP_ORIGIN is required outside development",
        })
      const databaseUrl = new URL(env.DATABASE_URL)
      if (
        !["require", "verify-ca", "verify-full"].includes(
          databaseUrl.searchParams.get("sslmode") ?? ""
        )
      )
        context.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Encrypted PostgreSQL is required outside development",
        })
    }
    if (
      env.APP_ENV === "production" &&
      env.DOCUMENT_STORAGE_DRIVER === "local" &&
      !env.ALLOW_UNSAFE_LOCAL_DOCUMENT_STORAGE
    )
      context.addIssue({
        code: "custom",
        path: ["DOCUMENT_STORAGE_DRIVER"],
        message: "Production requires durable document storage",
      })
    if (env.DOCUMENT_STORAGE_DRIVER === "s3") {
      for (const name of [
        "DOCUMENT_STORAGE_BUCKET",
        "DOCUMENT_STORAGE_REGION",
        "DOCUMENT_STORAGE_ACCESS_KEY_ID",
        "DOCUMENT_STORAGE_SECRET_ACCESS_KEY",
      ] as const)
        if (!env[name])
          context.addIssue({
            code: "custom",
            path: [name],
            message: `${name} is required for s3 storage`,
          })
    }
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
