export function isTripDelayed(input: {
  status: string
  dispatchedAt: Date | string | null
  expectedTransitDurationHours: number
  now?: Date
}): boolean {
  if (input.status !== "IN_TRANSIT" || !input.dispatchedAt) return false
  const dispatchedAt = new Date(input.dispatchedAt)
  if (Number.isNaN(dispatchedAt.getTime())) return false
  const now = input.now ?? new Date()
  return (
    now.getTime() - dispatchedAt.getTime() >
    input.expectedTransitDurationHours * 60 * 60 * 1000
  )
}

export function reportRoleAllowed(role: string): boolean {
  return role === "ADMIN" || role === "MEMBER"
}
