import { createFileRoute, Link } from "@tanstack/react-router"
import {
  IconBuilding,
  IconCar,
  IconPlus,
  IconSteeringWheel,
  IconTruck,
  IconUsers,
  IconCash,
  IconFileInvoice,
  IconTruckDelivery,
  IconAlertTriangle,
} from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminDashboardFn } from "@/server/admin/admin.functions"
import { getOperationsDashboardFn } from "@/server/operations/operations.functions"
import { getFinanceDashboardFn } from "@/server/finance/finance.functions"
import { formatInr } from "@/lib/format"
import { OperationsStatusBadge } from "@/components/operations/status-badge"

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: async () => {
    const [masters, operations, finance] = await Promise.all([
      getAdminDashboardFn(),
      getOperationsDashboardFn(),
      getFinanceDashboardFn(),
    ])
    return { masters, operations, finance }
  },
  component: AdminDashboard,
})

const countCards = [
  { key: "members", label: "Members", icon: IconUsers, to: "/admin/members" },
  {
    key: "vendors",
    label: "Vendors",
    icon: IconBuilding,
    to: "/admin/vendors",
  },
  {
    key: "drivers",
    label: "Drivers",
    icon: IconSteeringWheel,
    to: "/admin/drivers",
  },
  {
    key: "transporters",
    label: "Transporters",
    icon: IconTruck,
    to: "/admin/transporters",
  },
  { key: "vehicles", label: "Vehicles", icon: IconCar, to: "/admin/vehicles" },
  {
    key: "companies",
    label: "Companies",
    icon: IconBuilding,
    to: "/admin/companies",
  },
] as const

function AdminDashboard() {
  const { masters: counts, operations, finance } = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live organization counts and the most common setup actions."
      />
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Operations summary"
      >
        {(
          [
            ["Active Deals", operations.counts.activeDeals, IconFileInvoice],
            ["In Transit", operations.counts.inTransit, IconTruckDelivery],
            [
              "Delivered Today",
              operations.counts.deliveredToday,
              IconTruckDelivery,
            ],
            [
              "Needs Attention",
              operations.counts.needsAttention,
              IconAlertTriangle,
            ],
          ] as const
        ).map(([label, value, Icon]) => (
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
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Financial summary"
      >
        {(
          [
            ["Vendor Pending", finance.vendorPending],
            ["Transporter Pending", finance.transporterPending],
            ["Company Receivable", finance.companyReceivable],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold break-words tabular-nums">
                {formatInr(value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Users and masters</h2>
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          aria-label="Organization counts"
        >
          {countCards.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.key} to={item.to}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="gap-3">
                    <Icon className="size-5 text-muted-foreground" />
                    <CardTitle className="text-sm">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold tabular-nums">
                      {counts[item.key]}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Button
            render={<Link to="/admin/members/new" />}
            nativeButton={false}
          >
            <IconPlus data-icon="inline-start" />
            Add Member
          </Button>
          <Button
            render={<Link to="/admin/vendors/new" />}
            nativeButton={false}
            variant="outline"
          >
            <IconPlus data-icon="inline-start" />
            Add Vendor
          </Button>
          <Button
            render={<Link to="/admin/drivers/new" />}
            nativeButton={false}
            variant="outline"
          >
            <IconPlus data-icon="inline-start" />
            Add Driver
          </Button>
          <Button
            render={<Link to="/app/deals/new" />}
            nativeButton={false}
            variant="outline"
          >
            <IconPlus data-icon="inline-start" />
            Create Deal
          </Button>
          <Button
            render={
              <Link
                to="/app/payments/new"
                search={{
                  partyType: undefined,
                  partyId: undefined,
                  dealId: undefined,
                  tripId: undefined,
                  billId: undefined,
                }}
              />
            }
            nativeButton={false}
            variant="outline"
          >
            <IconCash data-icon="inline-start" />
            Create Payment
          </Button>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System attention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {operations.attentionItems.length ? (
              operations.attentionItems.map((item) => (
                <Link
                  key={item.id}
                  to="/app/trips/$tripId"
                  params={{ tripId: item.id }}
                  className="flex items-center justify-between gap-3 border-b py-2"
                >
                  <span>{item.tripNumber}</span>
                  <OperationsStatusBadge
                    status={
                      item.kind === "DELAYED" ? "DELAYED" : "WEIGHT ISSUE"
                    }
                  />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No operational exceptions.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Financial attention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {finance.attention.length ? (
              finance.attention.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  to="/app/trips/$tripId"
                  params={{ tripId: item.id }}
                  className="flex items-start justify-between gap-3 border-b py-2"
                >
                  <div>
                    <p>{item.tripNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.blockers.join(" · ")}
                    </p>
                  </div>
                  <OperationsStatusBadge status={item.status} />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No financial settlement blockers.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
