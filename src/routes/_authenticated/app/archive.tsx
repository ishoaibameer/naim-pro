import type { FormEvent } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  formatDate,
  formatDateTime,
  formatInr,
  formatWeight,
} from "@/lib/format"
import {
  getFinanceMastersFn,
  listArchiveFn,
} from "@/server/finance/finance.functions"
import { archiveListSchema } from "@/server/finance/schemas"

export const Route = createFileRoute("/_authenticated/app/archive")({
  validateSearch: archiveListSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    vendorId: search.vendorId,
    companyId: search.companyId,
    vehicleId: search.vehicleId,
    ownerMembershipId: search.ownerMembershipId,
    from: search.from,
    to: search.to,
    page: search.page,
    pageSize: search.pageSize,
  }),
  loader: async ({ deps }) => {
    const [archive, masters] = await Promise.all([
      listArchiveFn({ data: deps }),
      getFinanceMastersFn(),
    ])
    return { archive, masters }
  },
  component: ArchivePage,
})

function ArchivePage() {
  const { archive, masters } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: (previous) => ({
        ...previous,
        search: String(form.get("search") ?? ""),
        vendorId: String(form.get("vendorId") ?? "") || undefined,
        companyId: String(form.get("companyId") ?? "") || undefined,
        vehicleId: String(form.get("vehicleId") ?? "") || undefined,
        ownerMembershipId:
          String(form.get("ownerMembershipId") ?? "") || undefined,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
        page: 1,
      }),
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Records"
        title="Archive"
        description="Searchable, read-only settled Trip records and immutable financial snapshots."
      />
      <Alert>
        <AlertTitle>Historical records</AlertTitle>
        <AlertDescription>
          Archived Trips and their settlement snapshots are read-only.
          Corrections require explicit reversal workflows.
        </AlertDescription>
      </Alert>
      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          name="search"
          defaultValue={search.search}
          placeholder="Trip, vehicle, party, bill, receipt…"
          aria-label="Search archived trips"
        />
        <NativeSelect
          name="vendorId"
          defaultValue={search.vendorId ?? ""}
          className="w-full"
          aria-label="Filter by vendor"
        >
          <NativeSelectOption value="">All vendors</NativeSelectOption>
          {masters.vendors.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="companyId"
          defaultValue={search.companyId ?? ""}
          className="w-full"
          aria-label="Filter by company"
        >
          <NativeSelectOption value="">All companies</NativeSelectOption>
          {masters.companies.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="vehicleId"
          defaultValue={search.vehicleId ?? ""}
          className="w-full"
          aria-label="Filter by vehicle"
        >
          <NativeSelectOption value="">All vehicles</NativeSelectOption>
          {masters.vehicles.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="ownerMembershipId"
          defaultValue={search.ownerMembershipId ?? ""}
          className="w-full"
          aria-label="Filter by member"
        >
          <NativeSelectOption value="">All members</NativeSelectOption>
          {masters.members.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          name="from"
          type="date"
          defaultValue={search.from ?? ""}
          aria-label="Archived from"
        />
        <Input
          name="to"
          type="date"
          defaultValue={search.to ?? ""}
          aria-label="Archived to"
        />
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" />
          Filter
        </Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {archive.items.map((item) => (
          <Link
            key={item.id}
            to="/app/trips/$tripId"
            params={{ tripId: item.id }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{item.tripNumber}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="secondary">Archived</Badge>
                  <span className="truncate">
                    {item.vehicle ?? "No vehicle"}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  {item.vendor} → {item.company}
                </p>
                <p>Driver: {item.driver ?? "No driver"}</p>
                <p>Final weight: {formatWeight(item.finalWeightMt)}</p>
                <p>Purchase: {formatInr(item.materialValue)}</p>
                <p>Billed: {formatInr(item.billedAmount)}</p>
                <p>Settlement posted: {formatDate(item.settlementDate)}</p>
                <p className="text-xs text-muted-foreground">
                  Archived {formatDateTime(item.archivedAt)} by {item.owner}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!archive.items.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No archived Trips</EmptyTitle>
            <EmptyDescription>
              No historical records match these filters.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{archive.total} records</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={archive.page <= 1}
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
            disabled={archive.page * archive.pageSize >= archive.total}
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
