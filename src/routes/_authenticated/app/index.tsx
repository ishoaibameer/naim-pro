import { Link, createFileRoute } from "@tanstack/react-router"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconFileInvoice,
  IconLoader,
  IconTruckDelivery,
  IconCircleCheck,
} from "@tabler/icons-react"

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
import { formatDateTime } from "@/lib/format"
import { getOperationsDashboardFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/")({
  loader: () => getOperationsDashboardFn(),
  component: OperationsDashboard,
})

function OperationsDashboard() {
  const data = Route.useLoaderData()
  const cards = [
    ["Active Deals", data.counts.activeDeals, IconFileInvoice],
    ["Loading", data.counts.loading, IconLoader],
    ["In Transit", data.counts.inTransit, IconTruckDelivery],
    ["Delivered Today", data.counts.deliveredToday, IconCircleCheck],
    ["Needs Attention", data.counts.needsAttention, IconAlertTriangle],
  ] as const
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Operations"
        title="Home"
        description="Live movement summary for your organization."
        actions={
          <Button render={<Link to="/app/deals/new" />} nativeButton={false}>
            Create Deal
          </Button>
        }
      />
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
        aria-label="Operational counts"
      >
        {cards.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardHeader className="gap-2">
              <Icon className="size-5 text-muted-foreground" />
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>
              Delivered trips over the 1% weight threshold.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.attentionItems.length ? (
              data.attentionItems.map((item) => (
                <Link
                  key={item.id}
                  to="/app/trips/$tripId"
                  params={{ tripId: item.id }}
                  className="flex items-center justify-between gap-3 border-b py-2"
                >
                  <span>{item.tripNumber}</span>
                  <OperationsStatusBadge status="WEIGHT ISSUE" />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No trips need attention.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Trips</CardTitle>
            <CardDescription>Latest operational movements.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.recentTrips.map((item) => (
              <Link
                key={item.id}
                to="/app/trips/$tripId"
                params={{ tripId: item.id }}
                className="flex items-center justify-between gap-3 border-b py-2"
              >
                <div>
                  <p className="font-medium">{item.tripNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.dispatchedAt ?? item.createdAt)}
                  </p>
                </div>
                <OperationsStatusBadge status={item.status} />
              </Link>
            ))}
            <Button
              variant="outline"
              render={
                <Link
                  to="/app/trips"
                  search={{
                    tab: "ACTIVE",
                    search: "",
                    status: "ALL",
                    page: 1,
                    pageSize: 20,
                  }}
                />
              }
              nativeButton={false}
            >
              View All Trips
              <IconArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.recentActivity.map((item) => (
            <div key={item.id} className="border-b py-2">
              <p className="text-sm">{item.message}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(item.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
