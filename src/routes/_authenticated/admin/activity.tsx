import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconFilter } from "@tabler/icons-react"
import { z } from "zod"

import { PageHeader } from "@/components/admin/page-header"
import { RecordEmpty } from "@/components/admin/record-empty"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format"
import { listActivityFn } from "@/server/admin/admin.functions"

const searchSchema = z.object({
  q: z.string().catch(""),
  action: z.string().catch(""),
  from: z.string().catch(""),
  to: z.string().catch(""),
})
export const Route = createFileRoute("/_authenticated/admin/activity")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listActivityFn({
      data: {
        search: deps.q,
        action: deps.action,
        from: deps.from,
        to: deps.to,
        page: 1,
        pageSize: 30,
      },
    }),
  component: ActivityPage,
})

function ActivityPage() {
  const items = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    navigate({
      search: {
        q: String(form.get("q") ?? ""),
        action: String(form.get("action") ?? ""),
        from: String(form.get("from") ?? ""),
        to: String(form.get("to") ?? ""),
      },
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="System"
        title="Activity"
        description="Human-readable organization activity without raw audit payloads."
      />
      <form className="rounded-lg border bg-card p-4" onSubmit={filter}>
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="activity-user">Member / User</FieldLabel>
            <Input id="activity-user" name="q" defaultValue={search.q} />
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-action">Action Type</FieldLabel>
            <Input
              id="activity-action"
              name="action"
              defaultValue={search.action}
              placeholder="e.g. USER_CREATED"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-from">From</FieldLabel>
            <Input
              id="activity-from"
              name="from"
              type="date"
              defaultValue={search.from}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-to">To</FieldLabel>
            <Input
              id="activity-to"
              name="to"
              type="date"
              defaultValue={search.to}
            />
          </Field>
        </FieldGroup>
        <Button type="submit" variant="outline" className="mt-4">
          <IconFilter data-icon="inline-start" />
          Apply Filters
        </Button>
      </form>
      {items.length === 0 ? (
        <RecordEmpty
          title="No activity found"
          description="Activity appears here after organization actions occur."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.eventType}</Badge>
                    {item.entityType ? (
                      <span className="text-xs text-muted-foreground">
                        {item.entityType}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm">{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.actorName ?? "System"}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </time>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
