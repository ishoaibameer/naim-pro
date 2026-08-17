import "dotenv/config"

import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { hashPassword } from "../src/server/auth/password.server"
import { normalizePhone } from "../src/server/auth/phone"
import { closeDatabase, getDatabase } from "../src/server/db/index.server"
import {
  auditEvents,
  memberships,
  organizations,
  users,
} from "../src/server/db/schema"

const inputSchema = z.object({
  APP_ENV: z.literal("production"),
  NODE_ENV: z.literal("production"),
  PRODUCTION_BOOTSTRAP_CONFIRM: z.literal("CREATE_INITIAL_ADMIN"),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(160),
  BOOTSTRAP_ADMIN_PHONE: z.string().trim().min(1).max(64),
  BOOTSTRAP_ADMIN_PASSWORD: z
    .string()
    .min(14)
    .max(1024)
    .refine((value) => /[a-z]/.test(value), "Password needs lowercase text.")
    .refine((value) => /[A-Z]/.test(value), "Password needs uppercase text.")
    .refine((value) => /\d/.test(value), "Password needs a number.")
    .refine((value) => /[^A-Za-z0-9]/.test(value), "Password needs a symbol."),
  BOOTSTRAP_ORGANIZATION_NAME: z.string().trim().min(1).max(160),
})

async function main() {
  const parsed = inputSchema.safeParse(process.env)
  if (!parsed.success) {
    const names = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ]
    throw new Error(
      `Production bootstrap requirements failed: ${names.join(", ")}`
    )
  }
  const input = parsed.data
  const phoneE164 = normalizePhone(input.BOOTSTRAP_ADMIN_PHONE)
  const db = getDatabase()
  const outcome = await db.transaction(async (transaction) => {
    const organization = (
      await transaction
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.name, input.BOOTSTRAP_ORGANIZATION_NAME))
        .limit(1)
    ).at(0)
    const user = (
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phoneE164, phoneE164))
        .limit(1)
    ).at(0)

    if (user && !organization)
      throw new Error(
        "Bootstrap refused: the Admin user exists outside the requested organization."
      )

    let organizationId = organization?.id
    if (!organizationId) {
      organizationId = (
        await transaction
          .insert(organizations)
          .values({ name: input.BOOTSTRAP_ORGANIZATION_NAME })
          .returning({ id: organizations.id })
      )[0].id
    }

    let userId = user?.id
    if (!userId) {
      const passwordHash = await hashPassword(input.BOOTSTRAP_ADMIN_PASSWORD)
      userId = (
        await transaction
          .insert(users)
          .values({
            name: input.BOOTSTRAP_ADMIN_NAME,
            phoneE164,
            passwordHash,
            mustChangePassword: true,
          })
          .returning({ id: users.id })
      )[0].id
    }

    const membership = (
      await transaction
        .select({ id: memberships.id, role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.userId, userId)
          )
        )
        .limit(1)
    ).at(0)
    if (membership && membership.role !== "ADMIN")
      throw new Error(
        "Bootstrap refused: the existing membership is not ADMIN."
      )
    if (organization && user && membership) return "already-configured"

    const membershipId =
      membership?.id ??
      (
        await transaction
          .insert(memberships)
          .values({ organizationId, userId, role: "ADMIN" })
          .returning({ id: memberships.id })
      )[0].id
    await transaction.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      actorMembershipId: membershipId,
      action: "PRODUCTION_ADMIN_BOOTSTRAPPED",
      entityType: "USER",
      entityId: userId,
      after: { membershipId, role: "ADMIN", productionBootstrap: true },
    })
    return "created"
  })
  console.log(`Production bootstrap ${outcome}. Remove bootstrap inputs now.`)
}

try {
  await main()
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Production bootstrap failed."
  )
  process.exitCode = 1
} finally {
  await closeDatabase()
}
