import { Link } from "@tanstack/react-router"
import { IconArrowRight } from "@tabler/icons-react"

import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate } from "@/lib/format"

export interface VendorLoadCardData {
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
  createdAt: Date | string
}

export function VendorLoadCard({ load }: { load: VendorLoadCardData }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">
            {load.vehicle ?? load.tripNumber}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{load.tripNumber}</p>
        </div>
        <OperationsStatusBadge status={load.status} />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Material</dt>
            <dd className="font-medium">{load.material}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Route</dt>
            <dd>
              {load.pickup} → {load.destination}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Loaded</dt>
            <dd className="font-medium tabular-nums">
              {load.loadedWeightMt ? `${load.loadedWeightMt} t` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Final</dt>
            <dd className="font-medium tabular-nums">
              {load.finalWeightMt ? `${load.finalWeightMt} t` : "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Trip date</dt>
            <dd>{formatDate(load.dispatchedAt ?? load.createdAt)}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          render={
            <Link to="/vendor/loads/$tripId" params={{ tripId: load.id }} />
          }
          nativeButton={false}
        >
          View load
          <IconArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}
