import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { DriverEmpty } from "@/components/driver/driver-empty"
import { DriverTripCard } from "@/components/driver/driver-trip-card"
import { listDriverActiveTripsFn } from "@/server/driver/driver.functions"

export const Route = createFileRoute("/_authenticated/driver/trips/")({
  loader: () => listDriverActiveTripsFn(),
  component: DriverTrips,
})

function DriverTrips() {
  const trips = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Driver portal"
        title="Trips"
        description="Only active Trips currently assigned to you."
      />
      {trips.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {trips.map((trip) => (
            <DriverTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <DriverEmpty
          title="No active trips"
          description="There are no active Trips currently assigned to you."
        />
      )}
    </div>
  )
}
