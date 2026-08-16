import "@tanstack/react-start/server-only"

import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password.server"
import type { AuthRole, RecordStatus } from "./types"

export const GENERIC_CREDENTIAL_ERROR = "Invalid phone number or password."

export interface LoginCandidate {
  user: {
    id: string
    name: string
    passwordHash: string
    status: RecordStatus
    securityVersion: number
  }
  memberships: Array<{
    id: string
    organizationId: string
    role: AuthRole
    status: RecordStatus
    organizationStatus: RecordStatus
  }>
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super(GENERIC_CREDENTIAL_ERROR)
    this.name = "InvalidCredentialsError"
  }
}

export async function verifyLoginCandidate(
  candidate: LoginCandidate | null,
  password: string
): Promise<{
  candidate: LoginCandidate
  membership: LoginCandidate["memberships"][number]
}> {
  const passwordMatches = await verifyPassword(
    candidate?.user.passwordHash ?? DUMMY_PASSWORD_HASH,
    password
  )
  const activeMemberships =
    candidate?.memberships.filter(
      (membership) =>
        membership.status === "ACTIVE" &&
        membership.organizationStatus === "ACTIVE"
    ) ?? []

  if (
    !candidate ||
    !passwordMatches ||
    candidate.user.status !== "ACTIVE" ||
    activeMemberships.length !== 1
  ) {
    throw new InvalidCredentialsError()
  }

  return { candidate, membership: activeMemberships[0] }
}
