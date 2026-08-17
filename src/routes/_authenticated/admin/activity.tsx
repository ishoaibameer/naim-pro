import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconFilter } from "@tabler/icons-react"
import { z } from "zod"

import { PageHeader } from "@/components/admin/page-header"
import { RecordEmpty } from "@/components/admin/record-empty"
import { ActivityEntry } from "@/components/product/activity-entry"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { listActivityFn } from "@/server/admin/admin.functions"

const searchSchema = z.object({
  q: z.string().catch(""),
  action: z.string().catch(""),
  entity: z.string().catch(""),
  from: z.string().catch(""),
  to: z.string().catch(""),
})
export const Route = createFileRoute("/_authenticated/admin/activity")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { q, action, entity, from, to } }) => ({
    q,
    action,
    entity,
    from,
    to,
  }),
  loader: ({ deps }) =>
    listActivityFn({
      data: {
        search: deps.q,
        action: deps.action,
        entity: deps.entity,
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
        entity: String(form.get("entity") ?? ""),
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
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field>
            <FieldLabel htmlFor="activity-user">Member / User</FieldLabel>
            <Input id="activity-user" name="q" defaultValue={search.q} />
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-entity">Entity</FieldLabel>
            <Input
              id="activity-entity"
              name="entity"
              defaultValue={search.entity}
              placeholder="e.g. TRIP"
            />
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
            <ActivityEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
