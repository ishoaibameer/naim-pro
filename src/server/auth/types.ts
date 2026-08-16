import type { RECORD_STATUS_VALUES, ROLE_VALUES } from "@/server/db/schema"

export type AuthRole = (typeof ROLE_VALUES)[number]
export type RecordStatus = (typeof RECORD_STATUS_VALUES)[number]

export interface SafeAuthContext {
  user: {
    id: string
    name: string
    status: RecordStatus
  }
  membership: {
    id: string
    organizationId: string
    role: AuthRole
    status: RecordStatus
  }
}

export interface SessionRecordForValidation {
  id: string
  expiresAt: Date
  lastActiveAt: Date
  revokedAt: Date | null
  userSecurityVersion: number
  currentUserSecurityVersion: number
  userStatus: RecordStatus
  membershipStatus: RecordStatus
  organizationStatus: RecordStatus
}
