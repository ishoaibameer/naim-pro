import "@tanstack/react-start/server-only"

import { and, eq, isNull, lt } from "drizzle-orm"

import { getDatabase } from "@/server/db/index.server"
import { memberships, organizations, sessions, users } from "@/server/db/schema"

import { readSessionToken } from "./cookie.server"
import {
  isSessionRecordValid,
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_ACTIVITY_WRITE_INTERVAL_MS,
  shouldRefreshSessionActivity,
} from "./session-policy"
import { generateSessionToken, hashSessionToken } from "./tokens.server"
import type { SafeAuthContext } from "./types"

export interface CreateSessionInput {
  userId: string
  organizationId: string
  membershipId: string
  userSecurityVersion: number
  userAgent?: string | null
  now?: Date
}

export function prepareSession(input: CreateSessionInput) {
  const now = input.now ?? new Date()
  const token = generateSessionToken()
  return {
    token,
    values: {
      userId: input.userId,
      organizationId: input.organizationId,
      activeMembershipId: input.membershipId,
      tokenHash: hashSessionToken(token),
      userSecurityVersion: input.userSecurityVersion,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_LIFETIME_MS),
      userAgent: input.userAgent?.slice(0, 1000) ?? null,
    },
  }
}

export async function createSession(
  input: CreateSessionInput
): Promise<string> {
  const db = getDatabase()
  const session = prepareSession(input)

  await db.insert(sessions).values(session.values)

  return session.token
}

export async function validateSession(
  token: string,
  now = new Date()
): Promise<SafeAuthContext | null> {
  const db = getDatabase()
  const result = (
    await db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        lastActiveAt: sessions.lastActiveAt,
        revokedAt: sessions.revokedAt,
        sessionSecurityVersion: sessions.userSecurityVersion,
        userId: users.id,
        userName: users.name,
        userStatus: users.status,
        currentUserSecurityVersion: users.securityVersion,
        membershipId: memberships.id,
        organizationId: memberships.organizationId,
        membershipRole: memberships.role,
        membershipStatus: memberships.status,
        organizationStatus: organizations.status,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .innerJoin(
        memberships,
        and(
          eq(sessions.activeMembershipId, memberships.id),
          eq(sessions.organizationId, memberships.organizationId),
          eq(sessions.userId, memberships.userId)
        )
      )
      .innerJoin(
        organizations,
        eq(memberships.organizationId, organizations.id)
      )
      .where(eq(sessions.tokenHash, hashSessionToken(token)))
      .limit(1)
  ).at(0)

  if (
    !result ||
    !isSessionRecordValid(
      {
        id: result.sessionId,
        expiresAt: result.expiresAt,
        lastActiveAt: result.lastActiveAt,
        revokedAt: result.revokedAt,
        userSecurityVersion: result.sessionSecurityVersion,
        currentUserSecurityVersion: result.currentUserSecurityVersion,
        userStatus: result.userStatus,
        membershipStatus: result.membershipStatus,
        organizationStatus: result.organizationStatus,
      },
      now
    )
  ) {
    return null
  }

  if (shouldRefreshSessionActivity(result.lastActiveAt, now)) {
    await db
      .update(sessions)
      .set({ lastActiveAt: now })
      .where(
        and(
          eq(sessions.id, result.sessionId),
          lt(
            sessions.lastActiveAt,
            new Date(now.getTime() - SESSION_ACTIVITY_WRITE_INTERVAL_MS)
          ),
          isNull(sessions.revokedAt)
        )
      )
  }

  return {
    user: {
      id: result.userId,
      name: result.userName,
      status: result.userStatus,
    },
    membership: {
      id: result.membershipId,
      organizationId: result.organizationId,
      role: result.membershipRole,
      status: result.membershipStatus,
    },
  }
}

export async function revokeSession(
  token: string,
  now = new Date()
): Promise<void> {
  await getDatabase()
    .update(sessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        isNull(sessions.revokedAt)
      )
    )
}

export async function revokeAllUserSessions(
  userId: string,
  now = new Date()
): Promise<void> {
  await getDatabase()
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
}

export async function getCurrentAuthContext(): Promise<SafeAuthContext | null> {
  const token = readSessionToken()
  return token ? validateSession(token) : null
}
