import "@tanstack/react-start/server-only"

import { and, eq, isNull, sql } from "drizzle-orm"

import { getDatabase } from "@/server/db/index.server"
import type { Database } from "@/server/db/index.server"
import { auditEvents, memberships, sessions, users } from "@/server/db/schema"

import { hashPassword } from "./password.server"
import { normalizePhone } from "./phone"
import { ForbiddenError, requireRole } from "./policy"
import type { AuthRole, SafeAuthContext } from "./types"

const CREATABLE_ROLES: readonly AuthRole[] = ["MEMBER", "VENDOR", "DRIVER"]

export class DuplicatePhoneError extends Error {
  constructor() {
    super("A user with this phone number already exists.")
    this.name = "DuplicatePhoneError"
  }
}

export interface CreateUserAccountInput {
  name: string
  phone: string
  password: string
  role: AuthRole
  organizationId: string
}

export interface PreparedUserAccount {
  name: string
  phoneE164: string
  passwordHash: string
  role: Exclude<AuthRole, "ADMIN">
  organizationId: string
}

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export async function prepareUserAccount(
  actor: SafeAuthContext,
  input: CreateUserAccountInput
): Promise<PreparedUserAccount> {
  requireRole(actor, ["ADMIN"])
  if (input.organizationId !== actor.membership.organizationId) {
    throw new ForbiddenError()
  }
  if (!CREATABLE_ROLES.includes(input.role) || input.role === "ADMIN") {
    throw new ForbiddenError()
  }

  const name = input.name.trim()
  if (!name || name.length > 160) {
    throw new Error("Name must contain between 1 and 160 characters.")
  }

  return {
    name,
    phoneE164: normalizePhone(input.phone),
    passwordHash: await hashPassword(input.password),
    role: input.role,
    organizationId: input.organizationId,
  }
}

export async function insertPreparedUserAccount(
  transaction: DatabaseTransaction,
  actor: SafeAuthContext,
  prepared: PreparedUserAccount
): Promise<SafeAuthContext> {
  const existingUser = (
    await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneE164, prepared.phoneE164))
      .limit(1)
  ).at(0)
  if (existingUser) throw new DuplicatePhoneError()

  const now = new Date()
  const [user] = await transaction
    .insert(users)
    .values({
      name: prepared.name,
      phoneE164: prepared.phoneE164,
      passwordHash: prepared.passwordHash,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: users.id, status: users.status })
  const [membership] = await transaction
    .insert(memberships)
    .values({
      organizationId: prepared.organizationId,
      userId: user.id,
      role: prepared.role,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: memberships.id,
      organizationId: memberships.organizationId,
      role: memberships.role,
      status: memberships.status,
    })

  await transaction.insert(auditEvents).values({
    organizationId: actor.membership.organizationId,
    actorUserId: actor.user.id,
    actorMembershipId: actor.membership.id,
    action: "USER_CREATED",
    entityType: "USER",
    entityId: user.id,
    after: { membershipId: membership.id, role: membership.role },
    createdAt: now,
  })

  return {
    user: { id: user.id, name: prepared.name, status: user.status },
    membership,
  }
}

export async function createUserAccount(
  actor: SafeAuthContext,
  input: CreateUserAccountInput
): Promise<SafeAuthContext> {
  const prepared = await prepareUserAccount(actor, input)
  return getDatabase().transaction((transaction) =>
    insertPreparedUserAccount(transaction, actor, prepared)
  )
}

export async function resetUserPassword(
  actor: SafeAuthContext,
  targetUserId: string,
  newPassword: string
): Promise<void> {
  requireRole(actor, ["ADMIN"])
  const passwordHash = await hashPassword(newPassword)
  const now = new Date()

  await getDatabase().transaction(async (transaction) => {
    const target = (
      await transaction
        .select({
          userId: users.id,
          securityVersion: users.securityVersion,
        })
        .from(users)
        .innerJoin(
          memberships,
          and(
            eq(memberships.userId, users.id),
            eq(memberships.organizationId, actor.membership.organizationId)
          )
        )
        .where(eq(users.id, targetUserId))
        .limit(1)
    ).at(0)

    if (!target) throw new ForbiddenError()

    await transaction
      .update(users)
      .set({
        passwordHash,
        securityVersion: sql`${users.securityVersion} + 1`,
        version: sql`${users.version} + 1`,
        mustChangePassword: true,
        updatedAt: now,
      })
      .where(eq(users.id, target.userId))

    await transaction
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.userId, target.userId), isNull(sessions.revokedAt))
      )

    await transaction.insert(auditEvents).values({
      organizationId: actor.membership.organizationId,
      actorUserId: actor.user.id,
      actorMembershipId: actor.membership.id,
      action: "PASSWORD_RESET",
      entityType: "USER",
      entityId: target.userId,
      before: { securityVersion: target.securityVersion },
      after: {
        securityVersion: target.securityVersion + 1,
        sessionsRevoked: true,
        mustChangePassword: true,
      },
      createdAt: now,
    })
  })
}
