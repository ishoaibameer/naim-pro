import "dotenv/config"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { hashPassword } from "../src/server/auth/password.server"
import { normalizePhone } from "../src/server/auth/phone"
import { closeDatabase, getDatabase } from "../src/server/db/index.server"
import {
  auditEvents,
  drivers,
  memberships,
  organizations,
  users,
  vendors,
} from "../src/server/db/schema"

const fixtureSchema = z.object({
  TEST_DATABASE_URL: z.url(),
  E2E_ADMIN_PHONE: z.string().min(1),
  E2E_ADMIN_PASSWORD: z.string().min(10),
  E2E_MEMBER_PHONE: z.string().min(1),
  E2E_MEMBER_PASSWORD: z.string().min(10),
  E2E_VENDOR_PHONE: z.string().min(1),
  E2E_VENDOR_PASSWORD: z.string().min(10),
  E2E_DRIVER_PHONE: z.string().min(1),
  E2E_DRIVER_PASSWORD: z.string().min(10),
})

async function main() {
  if (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("E2E fixtures refuse a production environment.")
  const input = fixtureSchema.parse(process.env)
  const databaseName = new URL(input.TEST_DATABASE_URL).pathname.toLowerCase()
  if (!/(?:test|ci)/.test(databaseName))
    throw new Error(
      "E2E fixtures require a database name containing test or ci."
    )
  process.env.DATABASE_URL = input.TEST_DATABASE_URL
  const db = getDatabase()
  const existing = (
    await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.name, "NAIM PRO E2E"))
      .limit(1)
  ).at(0)
  if (existing) {
    console.log("E2E fixtures already exist.")
    return
  }
  const accounts = await Promise.all(
    [
      ["E2E Admin", input.E2E_ADMIN_PHONE, input.E2E_ADMIN_PASSWORD, "ADMIN"],
      [
        "E2E Member",
        input.E2E_MEMBER_PHONE,
        input.E2E_MEMBER_PASSWORD,
        "MEMBER",
      ],
      [
        "E2E Vendor",
        input.E2E_VENDOR_PHONE,
        input.E2E_VENDOR_PASSWORD,
        "VENDOR",
      ],
      [
        "E2E Driver",
        input.E2E_DRIVER_PHONE,
        input.E2E_DRIVER_PASSWORD,
        "DRIVER",
      ],
    ].map(async ([name, phone, password, role]) => ({
      name,
      phoneE164: normalizePhone(phone),
      passwordHash: await hashPassword(password),
      role: role as "ADMIN" | "MEMBER" | "VENDOR" | "DRIVER",
    }))
  )
  await db.transaction(async (transaction) => {
    const [organization] = await transaction
      .insert(organizations)
      .values({ name: "NAIM PRO E2E" })
      .returning({ id: organizations.id })
    const created = []
    for (const account of accounts) {
      const [user] = await transaction
        .insert(users)
        .values({
          name: account.name,
          phoneE164: account.phoneE164,
          passwordHash: account.passwordHash,
        })
        .returning({ id: users.id })
      const [membership] = await transaction
        .insert(memberships)
        .values({
          organizationId: organization.id,
          userId: user.id,
          role: account.role,
        })
        .returning({ id: memberships.id })
      created.push({ ...account, userId: user.id, membershipId: membership.id })
    }
    const admin = created.find((account) => account.role === "ADMIN")!
    const vendor = created.find((account) => account.role === "VENDOR")!
    const driver = created.find((account) => account.role === "DRIVER")!
    await transaction.insert(vendors).values({
      organizationId: organization.id,
      name: vendor.name,
      normalizedName: vendor.name.toLocaleUpperCase("en-IN"),
      userId: vendor.userId,
      phoneE164: vendor.phoneE164,
      createdByMembershipId: admin.membershipId,
      updatedByMembershipId: admin.membershipId,
    })
    await transaction.insert(drivers).values({
      organizationId: organization.id,
      name: driver.name,
      normalizedName: driver.name.toLocaleUpperCase("en-IN"),
      userId: driver.userId,
      phoneE164: driver.phoneE164,
      licenseNumber: "E2E-LICENSE",
      createdByMembershipId: admin.membershipId,
      updatedByMembershipId: admin.membershipId,
    })
    await transaction.insert(auditEvents).values({
      organizationId: organization.id,
      actorUserId: admin.userId,
      actorMembershipId: admin.membershipId,
      action: "E2E_FIXTURES_CREATED",
      entityType: "ORGANIZATION",
      entityId: organization.id,
      after: { roles: created.map((account) => account.role) },
    })
  })
  console.log("E2E fixtures created without printing credentials.")
}

try {
  await main()
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "E2E fixture setup failed."
  )
  process.exitCode = 1
} finally {
  await closeDatabase()
}
