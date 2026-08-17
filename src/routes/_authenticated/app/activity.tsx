import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconFilter } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { ActivityEntry } from "@/components/product/activity-entry"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { listOperationalActivityFn } from "@/server/operations/operations.functions"
import { operationalActivityQuerySchema } from "@/server/operations/schemas"

export const Route = createFileRoute("/_authenticated/app/activity")({
  validateSearch: operationalActivityQuerySchema,
  loaderDeps: ({ search: { actor, type, entity, from, to } }) => ({
    actor,
    type,
    entity,
    from,
    to,
  }),
  loader: ({ deps }) => listOperationalActivityFn({ data: deps }),
  component: Activity,
})

function Activity() {
  const rows = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: {
        actor: String(form.get("actor") ?? ""),
        type: String(form.get("type") ?? ""),
        entity: String(form.get("entity") ?? ""),
        from: String(form.get("from") ?? ""),
        to: String(form.get("to") ?? ""),
      },
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Accountability"
        title="Activity"
        description="Recent human-readable organization actions; audit payloads remain internal."
      />
      <form onSubmit={submit} className="rounded-lg border bg-card p-4">
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field>
            <FieldLabel htmlFor="activity-actor">Actor</FieldLabel>
            <Input
              id="activity-actor"
              name="actor"
              defaultValue={search.actor}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-type">Type</FieldLabel>
            <Input
              id="activity-type"
              name="type"
              defaultValue={search.type}
              placeholder="PAYMENT POSTED"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="activity-entity">Entity</FieldLabel>
            <Input
              id="activity-entity"
              name="entity"
              defaultValue={search.entity}
              placeholder="TRIP"
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
          Apply filters
        </Button>
      </form>
      {rows.length ? (
        <div className="flex flex-col gap-3">
          {rows.map((item) => (
            <ActivityEntry key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No activity found</EmptyTitle>
            <EmptyDescription>
              Try a broader filter or date range.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
