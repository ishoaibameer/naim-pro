import type { TRIP_STATUS_VALUES } from "@/server/db/schema"

export type TripStatus = (typeof TRIP_STATUS_VALUES)[number]

export const TRIP_TRANSITIONS: Readonly<
  Record<TripStatus, readonly TripStatus[]>
> = {
  CREATED: ["TRUCK_ASSIGNED", "CANCELLED"],
  TRUCK_ASSIGNED: ["LOADING", "CANCELLED"],
  LOADING: ["LOADED", "CANCELLED"],
  LOADED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: ["SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["SETTLED"],
  SETTLED: ["ARCHIVED"],
  ARCHIVED: [],
  CANCELLED: [],
}

export const CANCELLABLE_TRIP_STATUSES: readonly TripStatus[] = [
  "CREATED",
  "TRUCK_ASSIGNED",
  "LOADING",
  "LOADED",
]

export class TripTransitionError extends Error {
  constructor(from: TripStatus, to: TripStatus) {
    super(`Trip cannot move from ${from} to ${to}.`)
    this.name = "TripTransitionError"
  }
}

export class TripConcurrencyError extends Error {
  constructor() {
    super("This Trip was updated by another member. Refresh and try again.")
    this.name = "TripConcurrencyError"
  }
}

export function canTransitionTrip(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from].includes(to)
}

export function assertTripTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransitionTrip(from, to)) throw new TripTransitionError(from, to)
}

export function canCancelTrip(status: TripStatus): boolean {
  return CANCELLABLE_TRIP_STATUSES.includes(status)
}

export type TripPrimaryAction =
  | "START_LOADING"
  | "CONFIRM_LOADING"
  | "START_JOURNEY"
  | "CONFIRM_DELIVERY"
  | null

export function getTripPrimaryAction(status: TripStatus): TripPrimaryAction {
  switch (status) {
    case "TRUCK_ASSIGNED":
      return "START_LOADING"
    case "LOADING":
      return "CONFIRM_LOADING"
    case "LOADED":
      return "START_JOURNEY"
    case "IN_TRANSIT":
      return "CONFIRM_DELIVERY"
    default:
      return null
  }
}
