import { PageHeader } from "@/components/admin/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function MasterDirectory({
  title,
  description,
  records,
}: {
  title: string
  description: string
  records: ReadonlyArray<{ id: string; label: string }>
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Directory" title={title} description={description} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {records.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <CardTitle>{record.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Active organization record
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {!records.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No active records. Ask an Administrator to add one.
        </p>
      ) : null}
    </div>
  )
}
