import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { VendorEmpty } from "@/components/vendor/vendor-empty"
import { VendorLoadCard } from "@/components/vendor/vendor-load-card"
import { vendorLoadListSchema } from "@/server/vendor/schemas"
import { listVendorLoadsFn } from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor/loads/")({
  validateSearch: vendorLoadListSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listVendorLoadsFn({ data: deps }),
  component: VendorLoads,
})

function VendorLoads() {
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
        eyebrow="My loads"
        title="Loads"
        description="Track material movement connected to your vendor account."
      />
      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input
          name="search"
          defaultValue={search.search}
          placeholder="Trip, vehicle, place, challan..."
          className="lg:col-span-2"
        />
        <NativeSelect name="status" defaultValue={search.status}>
          <NativeSelectOption value="ALL">All statuses</NativeSelectOption>
          <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
          <NativeSelectOption value="IN_TRANSIT">In transit</NativeSelectOption>
          <NativeSelectOption value="DELIVERED">Delivered</NativeSelectOption>
          <NativeSelectOption value="ARCHIVED">Archived</NativeSelectOption>
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={search.from ?? ""}
          aria-label="From date"
        />
        <Input
          type="date"
          name="to"
          defaultValue={search.to ?? ""}
          aria-label="To date"
        />
        <Button
          type="submit"
          variant="outline"
          className="sm:col-span-2 lg:col-span-1"
        >
          <IconSearch data-icon="inline-start" /> Filter
        </Button>
      </form>
      {data.items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((load) => (
            <VendorLoadCard key={load.id} load={load} />
          ))}
        </div>
      ) : (
        <VendorEmpty
          title="No matching loads"
          description="Try clearing or changing the search filters."
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data.total} loads</p>
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
