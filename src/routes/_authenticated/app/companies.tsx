import { Link, createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getOperationalMastersFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/companies")({
  loader: () => getOperationalMastersFn(),
  component: CompaniesDirectory,
})
function CompaniesDirectory() {
  const data = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Directory"
        title="Companies"
        description="Customer billing, receipts, and receivables."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.companies.map((item) => (
          <Link
            key={item.id}
            to="/app/companies/$companyId"
            params={{ companyId: item.id }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View billing summary
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
