import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconSearch } from "@tabler/icons-react"
import { PageHeader } from "@/components/admin/page-header"
import { DriverEmpty } from "@/components/driver/driver-empty"
import { DriverTripCard } from "@/components/driver/driver-trip-card"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { driverTripListSchema } from "@/server/driver/schemas"
import { listDriverHistoryFn } from "@/server/driver/driver.functions"

export const Route = createFileRoute("/_authenticated/driver/history")({
  validateSearch: driverTripListSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    status: search.status,
    from: search.from,
    to: search.to,
    page: search.page,
    pageSize: search.pageSize,
  }),
  loader: ({ deps }) => listDriverHistoryFn({ data: deps }),
  component: DriverHistory,
})

function DriverHistory() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: {
        search: String(form.get("search") ?? ""),
        status: String(form.get("status") ?? "ALL") as typeof search.status,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
        page: 1,
        pageSize: search.pageSize,
      },
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Driver portal"
        title="Trip history"
        description="Completed Trips that were assigned to you."
      />
      <form onSubmit={submit}>
        <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-5">
          <Field className="lg:col-span-2">
            <FieldLabel htmlFor="driver-history-search">
              Vehicle or Trip
            </FieldLabel>
            <Input
              id="driver-history-search"
              name="search"
              defaultValue={search.search}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="driver-history-status">Status</FieldLabel>
            <NativeSelect
              id="driver-history-status"
              name="status"
              defaultValue={search.status}
            >
              <NativeSelectOption value="ALL">All completed</NativeSelectOption>
              <NativeSelectOption value="DELIVERED">
                Delivered
              </NativeSelectOption>
              <NativeSelectOption value="SETTLEMENT_PENDING">
                Settlement pending
              </NativeSelectOption>
              <NativeSelectOption value="SETTLED">Settled</NativeSelectOption>
              <NativeSelectOption value="ARCHIVED">Archived</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="driver-history-from">From</FieldLabel>
            <Input
              id="driver-history-from"
              type="date"
              name="from"
              defaultValue={search.from ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="driver-history-to">To</FieldLabel>
            <Input
              id="driver-history-to"
              type="date"
              name="to"
              defaultValue={search.to ?? ""}
            />
          </Field>
        </FieldGroup>
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" />
          Filter history
        </Button>
      </form>
      {data.items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.items.map((trip) => (
            <DriverTripCard key={trip.id} trip={trip} historical />
          ))}
        </div>
      ) : (
        <DriverEmpty
          title="No history found"
          description="Try changing the date, vehicle, or status filters."
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data.total} Trips</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            onClick={() =>
              navigate({
                search: (previous) => ({
                  ...previous,
                  page: previous.page - 1,
                }),
              })
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={data.page * data.pageSize >= data.total}
            onClick={() =>
              navigate({
                search: (previous) => ({
                  ...previous,
                  page: previous.page + 1,
                }),
              })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
