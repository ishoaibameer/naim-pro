import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { DriverEmpty } from "@/components/driver/driver-empty"
import { DriverPrimaryAction } from "@/components/driver/driver-primary-action"
import { DriverTripCard } from "@/components/driver/driver-trip-card"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, formatWeight } from "@/lib/format"
import { getDriverHomeFn } from "@/server/driver/driver.functions"

export const Route = createFileRoute("/_authenticated/driver/")({
  loader: () => getDriverHomeFn(),
  component: DriverHome,
})

function DriverHome() {
  const data = Route.useLoaderData()
  const trip = data.currentTrip
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Driver portal"
        title="Current trip"
        description="Your current assignment and next permitted action."
      />
      {trip ? (
        <>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">
                  {trip.vehicle ?? trip.tripNumber}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {trip.tripNumber}
                </p>
              </div>
              <OperationsStatusBadge status={trip.status} />
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-5 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Route</dt>
                  <dd className="text-lg font-semibold">
                    {trip.pickup} → {trip.destination}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    Destination company
                  </dt>
                  <dd className="font-medium">{trip.company}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Material</dt>
                  <dd>{trip.material}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Loaded weight
                  </dt>
                  <dd>
                    {trip.loadedWeightMt
                      ? formatWeight(trip.loadedWeightMt)
                      : "Not recorded"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    Dispatch time
                  </dt>
                  <dd>{formatDateTime(trip.dispatchedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {trip.action ? (
            <DriverPrimaryAction
              action={trip.action}
              tripId={trip.id}
              version={trip.version}
            />
          ) : null}
        </>
      ) : (
        <DriverEmpty
          title="No active trip assigned"
          description="Your next assigned Trip will appear here automatically."
        />
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent completed trips</h2>
        {data.recentTrips.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.recentTrips.map((recent) => (
              <DriverTripCard key={recent.id} trip={recent} historical />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No completed Trips yet.
          </p>
        )}
      </section>
    </div>
  )
}
