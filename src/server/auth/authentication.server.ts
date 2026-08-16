import "@tanstack/react-start/server-only"

import { createHmac } from "node:crypto"
import { and, count, eq, gte } from "drizzle-orm"

import { getDatabase } from "@/server/db/index.server"
import {
  auditEvents,
  authLoginFailures,
  memberships,
  organizations,
  sessions,
  users,
} from "@/server/db/schema"
import { getServerEnv } from "@/server/env.server"

import {
  InvalidCredentialsError,
  verifyLoginCandidate,
} from "./authentication-policy.server"
import type { LoginCandidate } from "./authentication-policy.server"
import { normalizePhone } from "./phone"
import { isLoginThrottled, LOGIN_FAILURE_WINDOW_MS } from "./rate-limit"
import {
  prepareSession,
  revokeSession,
  validateSession,
} from "./session.server"
import type { SafeAuthContext } from "./types"

export interface PasswordAuthenticationInput {
  phone: string
  password: string
  networkIdentifier: string
  userAgent?: string | null
}

export interface PasswordAuthenticationResult {
  auth: SafeAuthContext
  sessionToken: string
}

function createPrivateLookupKey(kind: string, value: string): string {
  return createHmac("sha256", getServerEnv().SESSION_SECRET)
    .update(`${kind}:${value}`, "utf8")
    .digest("hex")
}

async function findLoginCandidate(
  phoneE164: string | null
): Promise<LoginCandidate | null> {
  if (!phoneE164) return null

  const db = getDatabase()
  const user = (
    await db
      .select({
        id: users.id,
        name: users.name,
        passwordHash: users.passwordHash,
        status: users.status,
        securityVersion: users.securityVersion,
      })
      .from(users)
      .where(eq(users.phoneE164, phoneE164))
      .limit(1)
  ).at(0)

  if (!user) return null

  const userMemberships = await db
    .select({
      id: memberships.id,
      organizationId: memberships.organizationId,
      role: memberships.role,
      status: memberships.status,
      organizationStatus: organizations.status,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, user.id))

  return { user, memberships: userMemberships }
}

export async function authenticateWithPassword(
  input: PasswordAuthenticationInput
): Promise<PasswordAuthenticationResult> {
  const db = getDatabase()
  let phoneE164: string | null = null
  try {
    phoneE164 = normalizePhone(input.phone)
  } catch {
    // Invalid and unknown numbers still follow the dummy-hash path below.
  }

  const accountKey = createPrivateLookupKey(
    "account",
    phoneE164 ?? input.phone.trim().slice(0, 128)
  )
  const networkKey = createPrivateLookupKey(
    "network",
    input.networkIdentifier.slice(0, 128)
  )
  const windowStart = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS)
  const [[accountCount], [networkCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(authLoginFailures)
      .where(
        and(
          eq(authLoginFailures.accountKey, accountKey),
          gte(authLoginFailures.attemptedAt, windowStart)
        )
      ),
    db
      .select({ value: count() })
      .from(authLoginFailures)
      .where(
        and(
          eq(authLoginFailures.networkKey, networkKey),
          gte(authLoginFailures.attemptedAt, windowStart)
        )
      ),
  ])

  const candidate = await findLoginCandidate(phoneE164)

  try {
    if (isLoginThrottled(accountCount.value, networkCount.value)) {
      await verifyLoginCandidate(null, input.password)
    }

    const verified = await verifyLoginCandidate(candidate, input.password)
    const now = new Date()
    const auth: SafeAuthContext = {
      user: {
        id: verified.candidate.user.id,
        name: verified.candidate.user.name,
        status: verified.candidate.user.status,
      },
      membership: {
        id: verified.membership.id,
        organizationId: verified.membership.organizationId,
        role: verified.membership.role,
        status: verified.membership.status,
      },
    }

    const session = prepareSession({
      userId: auth.user.id,
      organizationId: auth.membership.organizationId,
      membershipId: auth.membership.id,
      userSecurityVersion: verified.candidate.user.securityVersion,
      userAgent: input.userAgent,
      now,
    })

    await db.transaction(async (transaction) => {
      await transaction.insert(sessions).values(session.values)
      await transaction
        .update(users)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(users.id, auth.user.id))
      await transaction
        .delete(authLoginFailures)
        .where(eq(authLoginFailures.accountKey, accountKey))
      await transaction.insert(auditEvents).values({
        organizationId: auth.membership.organizationId,
        actorUserId: auth.user.id,
        actorMembershipId: auth.membership.id,
        action: "LOGIN_SUCCESS",
        entityType: "USER",
        entityId: auth.user.id,
        after: { membershipId: auth.membership.id },
        createdAt: now,
      })
    })

    return { auth, sessionToken: session.token }
  } catch (error) {
    if (!(error instanceof InvalidCredentialsError)) throw error

    await db.insert(authLoginFailures).values({ accountKey, networkKey })
    throw new InvalidCredentialsError()
  }
}

export async function logoutSession(token: string): Promise<void> {
  const auth = await validateSession(token)
  await revokeSession(token)
  if (!auth) return

  await getDatabase()
    .insert(auditEvents)
    .values({
      organizationId: auth.membership.organizationId,
      actorUserId: auth.user.id,
      actorMembershipId: auth.membership.id,
      action: "LOGOUT",
      entityType: "USER",
      entityId: auth.user.id,
      after: { sessionRevoked: true },
    })
}
