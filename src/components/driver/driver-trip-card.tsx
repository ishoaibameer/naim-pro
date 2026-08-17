import { Link } from "@tanstack/react-router"
import { IconArrowRight } from "@tabler/icons-react"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface DriverTripCardData {
  id: string
  tripNumber: string
  status: string
  vehicle: string | null
  material: string
  pickup: string
  destination: string
  loadedWeightMt: string | null
  finalWeightMt: string | null
  dispatchedAt: Date | string | null
  deliveredAt: Date | string | null
  createdAt: Date | string
}

export function DriverTripCard({
  trip,
  historical = false,
}: {
  trip: DriverTripCardData
  historical?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-lg">
            {trip.vehicle ?? trip.tripNumber}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{trip.tripNumber}</p>
        </div>
        <OperationsStatusBadge status={trip.status} />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Route</dt>
            <dd className="font-medium">
              {trip.pickup} → {trip.destination}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Material</dt>
            <dd>{trip.material}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Loaded</dt>
            <dd>
              {trip.loadedWeightMt
                ? `${trip.loadedWeightMt} t`
                : "Not recorded"}
            </dd>
          </div>
          {historical ? (
            <div>
              <dt className="text-xs text-muted-foreground">Final</dt>
              <dd>
                {trip.finalWeightMt
                  ? `${trip.finalWeightMt} t`
                  : "Not recorded"}
              </dd>
            </div>
          ) : null}
          <div className={historical ? "col-span-2" : undefined}>
            <dt className="text-xs text-muted-foreground">
              {historical ? "Completed" : "Trip date"}
            </dt>
            <dd>
              {formatDate(
                historical
                  ? trip.deliveredAt
                  : (trip.dispatchedAt ?? trip.createdAt)
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Link
          to="/driver/trips/$tripId"
          params={{ tripId: trip.id }}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Open trip <IconArrowRight data-icon="inline-end" />
        </Link>
      </CardFooter>
    </Card>
  )
}
