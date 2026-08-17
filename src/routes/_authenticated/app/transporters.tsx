import { Link, createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getOperationalMastersFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/transporters")({
  loader: () => getOperationalMastersFn(),
  component: TransportersDirectory,
})
function TransportersDirectory() {
  const data = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Directory"
        title="Transporters"
        description="Freight liabilities, Trips, and payment history."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.transporters.map((item) => (
          <Link
            key={item.id}
            to="/app/transporters/$transporterId"
            params={{ transporterId: item.id }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View finance summary
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
