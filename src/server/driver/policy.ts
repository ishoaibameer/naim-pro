import type { AuthRole } from "@/server/auth/types"

export function canDriverStartJourney(input: {
  status: string
  currentDriverId: string | null
  driverId: string
  hasOpenAssignment: boolean
  vehicleActive: boolean
}): boolean {
  return (
    input.status === "LOADED" &&
    input.currentDriverId === input.driverId &&
    input.hasOpenAssignment &&
    input.vehicleActive
  )
}

export function canDriverCheckIn(
  status: string,
  type: "REACHED_PICKUP" | "REACHED_DESTINATION"
): boolean {
  return type === "REACHED_PICKUP"
    ? status === "TRUCK_ASSIGNED"
    : status === "IN_TRANSIT"
}

export function canReviewDriverExpense(role: AuthRole): boolean {
  return role === "ADMIN" || role === "MEMBER"
}
