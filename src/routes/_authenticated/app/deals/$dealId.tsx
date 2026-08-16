import { Link, createFileRoute } from "@tanstack/react-router"
import { IconPlus } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime } from "@/lib/format"
import { getDealFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/deals/$dealId")({
  loader: ({ params }) => getDealFn({ data: { id: params.dealId } }),
  component: DealDetail,
})
function DealDetail() {
  const deal = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Deal"
        title={deal.dealNumber}
        description={`${deal.vendor} · ${deal.material}`}
        actions={
          <Button
            render={
              <Link
                to="/app/deals/$dealId/trips/new"
                params={{ dealId: deal.id }}
              />
            }
            nativeButton={false}
          >
            <IconPlus data-icon="inline-start" />
            Add Truck
          </Button>
        }
      />
      <OperationsStatusBadge status={deal.status} />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Vendor", deal.vendor],
                  ["Pickup", deal.pickup],
                  ["Material", deal.material],
                  ["Rate", `₹${deal.purchaseRate}/t`],
                  [
                    "Expected Quantity",
                    deal.expectedQuantityMt
                      ? `${deal.expectedQuantityMt} t`
                      : "—",
                  ],
                  ["Owner", deal.owner],
                  ["Created by", deal.createdBy],
                  ["Created at", formatDateTime(deal.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase">
                      {label}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {deal.notes ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  {deal.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="trips">
          <Card>
            <CardHeader>
              <CardTitle>Trips</CardTitle>
              <CardDescription>
                One Deal may have many truck movements.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deal.trips.length ? (
                deal.trips.map((trip) => (
                  <Link
                    key={trip.id}
                    to="/app/trips/$tripId"
                    params={{ tripId: trip.id }}
                    className="flex items-center justify-between border-b py-3"
                  >
                    <span>{trip.tripNumber}</span>
                    <OperationsStatusBadge status={trip.status} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trucks assigned yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {["payments", "documents"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{tab}</CardTitle>
                <CardDescription>
                  This area is reserved for a later implementation step.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        ))}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Recorded Deal actions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deal.events.map((event) => (
                <div key={event.id} className="border-b py-2">
                  <p>{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
              ))}
              {!deal.events.length ? (
                <p className="text-sm text-muted-foreground">
                  No Deal activity recorded.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
