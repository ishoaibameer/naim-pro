import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import { listOperationalActivityFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/activity")({
  loader: () => listOperationalActivityFn(),
  component: Activity,
})
function Activity() {
  const rows = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Accountability"
        title="Activity"
        description="Recent human-readable organization actions."
      />
      <Card>
        <CardContent className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.id} className="border-b py-3">
              <p>{row.message}</p>
              <p className="text-xs text-muted-foreground">
                {row.actorName ?? "System"} · {formatDateTime(row.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
