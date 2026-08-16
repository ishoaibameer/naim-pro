import "dotenv/config"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { closeDatabase, getDatabase } from "../src/server/db/index.server"
import {
  auditEvents,
  memberships,
  organizations,
  users,
} from "../src/server/db/schema"
import { hashPassword } from "../src/server/auth/password.server"
import { normalizePhone } from "../src/server/auth/phone"

const bootstrapEnvSchema = z.object({
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(160),
  BOOTSTRAP_ADMIN_PHONE: z.string().trim().min(1).max(64),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(10).max(1024),
  BOOTSTRAP_ORGANIZATION_NAME: z.string().trim().min(1).max(160),
})

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development auth bootstrap refuses production use.")
  }

  const parsed = bootstrapEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const names = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ]
    throw new Error(
      `Missing or invalid bootstrap environment: ${names.join(", ")}`
    )
  }

  const env = parsed.data
  const phoneE164 = normalizePhone(env.BOOTSTRAP_ADMIN_PHONE)
  const passwordHash = await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD)
  const db = getDatabase()
  const now = new Date()

  const result = await db.transaction(async (transaction) => {
    const existingUser = (
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phoneE164, phoneE164))
        .limit(1)
    ).at(0)
    if (existingUser) {
      throw new Error("Bootstrap refused: the normalized phone already exists.")
    }

    const existingOrganization = (
      await transaction
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.name, env.BOOTSTRAP_ORGANIZATION_NAME))
        .limit(1)
    ).at(0)
    if (existingOrganization) {
      throw new Error(
        "Bootstrap refused: the organization name already exists."
      )
    }

    const [organization] = await transaction
      .insert(organizations)
      .values({
        name: env.BOOTSTRAP_ORGANIZATION_NAME,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: organizations.id, name: organizations.name })
    const [user] = await transaction
      .insert(users)
      .values({
        name: env.BOOTSTRAP_ADMIN_NAME,
        phoneE164,
        passwordHash,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id })
    const [membership] = await transaction
      .insert(memberships)
      .values({
        organizationId: organization.id,
        userId: user.id,
        role: "ADMIN",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: memberships.id })

    await transaction.insert(auditEvents).values({
      organizationId: organization.id,
      actorUserId: user.id,
      actorMembershipId: membership.id,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: user.id,
      after: { membershipId: membership.id, role: "ADMIN", bootstrap: true },
      createdAt: now,
    })

    return { organizationName: organization.name }
  })

  console.log(`Development admin created for ${result.organizationName}.`)
  console.log("The password and session secret were not printed.")
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : "Bootstrap failed.")
  process.exitCode = 1
} finally {
  await closeDatabase()
}
