import { createFileRoute, Link } from "@tanstack/react-router"
import {
  IconBuilding,
  IconCar,
  IconPlus,
  IconSteeringWheel,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminDashboardFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: () => getAdminDashboardFn(),
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
  const counts = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live organization counts and the most common setup actions."
      />
      <section
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
            render={<Link to="/admin/transporters" />}
            nativeButton={false}
            variant="outline"
          >
            <IconPlus data-icon="inline-start" />
            Add Transporter
          </Button>
        </div>
      </section>
    </div>
  )
}
