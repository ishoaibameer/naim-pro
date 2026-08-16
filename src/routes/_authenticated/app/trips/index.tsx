import type { FormEvent } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime } from "@/lib/format"
import {
  getOperationalMastersFn,
  listTripsFn,
} from "@/server/operations/operations.functions"
import { tripListSchema } from "@/server/operations/schemas"

export const Route = createFileRoute("/_authenticated/app/trips/")({
  validateSearch: tripListSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [trips, masters] = await Promise.all([
      listTripsFn({ data: deps }),
      getOperationalMastersFn(),
    ])
    return { trips, masters }
  },
  component: TripsList,
})
function TripsList() {
  const { trips: data, masters } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: (prev) => ({
        ...prev,
        search: String(form.get("search") ?? ""),
        status: String(form.get("status") ?? "ALL") as typeof prev.status,
        vendorId: String(form.get("vendorId") ?? "") || undefined,
        vehicleId: String(form.get("vehicleId") ?? "") || undefined,
        driverId: String(form.get("driverId") ?? "") || undefined,
        pickupLocationId:
          String(form.get("pickupLocationId") ?? "") || undefined,
        destinationLocationId:
          String(form.get("destinationLocationId") ?? "") || undefined,
        transporterId: String(form.get("transporterId") ?? "") || undefined,
        companyId: String(form.get("companyId") ?? "") || undefined,
        ownerMembershipId:
          String(form.get("ownerMembershipId") ?? "") || undefined,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
        page: 1,
      }),
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Trips"
        description="Physical truck movements, paginated 20 at a time."
      />
      <Tabs
        value={search.tab}
        onValueChange={(value) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              tab: value as typeof prev.tab,
              page: 1,
            }),
          })
        }
      >
        <TabsList>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="ARCHIVE">Archive</TabsTrigger>
        </TabsList>
      </Tabs>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={submit}
      >
        <Input
          name="search"
          defaultValue={search.search}
          placeholder="Trip, vehicle, driver, route, challan…"
        />
        <NativeSelect name="status" defaultValue={search.status}>
          <NativeSelectOption value="ALL">All statuses</NativeSelectOption>
          {[
            "TRUCK_ASSIGNED",
            "LOADING",
            "LOADED",
            "IN_TRANSIT",
            "DELIVERED",
            "CANCELLED",
          ].map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status.replaceAll("_", " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {[
          ["vendorId", "All vendors", search.vendorId, masters.vendors],
          ["vehicleId", "All vehicles", search.vehicleId, masters.vehicles],
          ["driverId", "All drivers", search.driverId, masters.drivers],
          [
            "pickupLocationId",
            "All pickups",
            search.pickupLocationId,
            masters.locations,
          ],
          [
            "destinationLocationId",
            "All destinations",
            search.destinationLocationId,
            masters.locations,
          ],
          [
            "transporterId",
            "All transporters",
            search.transporterId,
            masters.transporters,
          ],
          ["companyId", "All companies", search.companyId, masters.companies],
          [
            "ownerMembershipId",
            "All owners",
            search.ownerMembershipId,
            masters.members,
          ],
        ].map(([name, label, value, items]) => (
          <NativeSelect
            key={String(name)}
            name={String(name)}
            defaultValue={String(value ?? "")}
            aria-label={String(label)}
          >
            <NativeSelectOption value="">{String(label)}</NativeSelectOption>
            {(items as ReadonlyArray<{ id: string; label: string }>).map(
              (item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.label}
                </NativeSelectOption>
              )
            )}
          </NativeSelect>
        ))}
        <Input
          type="date"
          name="from"
          defaultValue={search.from ?? ""}
          aria-label="Created from"
        />
        <Input
          type="date"
          name="to"
          defaultValue={search.to ?? ""}
          aria-label="Created to"
        />
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" />
          Search
        </Button>
      </form>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.items.map((trip) => (
          <Link
            key={trip.id}
            to="/app/trips/$tripId"
            params={{ tripId: trip.id }}
          >
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">
                      {trip.vehicle ?? "Truck pending"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {trip.tripNumber}
                    </p>
                  </div>
                  <OperationsStatusBadge status={trip.status} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="font-medium">
                  {trip.vendor} → {trip.company}
                </p>
                <p>
                  {trip.pickup} → {trip.destination}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <p>
                    <span className="text-muted-foreground">Loaded</span>
                    <br />
                    {trip.loadedWeightMt ? `${trip.loadedWeightMt} t` : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Driver</span>
                    <br />
                    {trip.driver ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Owner</span>
                    <br />
                    {trip.owner}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Time</span>
                    <br />
                    {formatDateTime(trip.dispatchedAt ?? trip.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!data.items.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No Trips match these filters.
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.total} records</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={data.page * data.pageSize >= data.total}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
