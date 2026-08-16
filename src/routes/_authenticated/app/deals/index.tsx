import type { FormEvent } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconPlus, IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import {
  getOperationalMastersFn,
  listDealsFn,
} from "@/server/operations/operations.functions"
import { dealListSchema } from "@/server/operations/schemas"

export const Route = createFileRoute("/_authenticated/app/deals/")({
  validateSearch: dealListSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [deals, masters] = await Promise.all([
      listDealsFn({ data: deps }),
      getOperationalMastersFn(),
    ])
    return { deals, masters }
  },
  component: DealsList,
})

function DealsList() {
  const { deals: data, masters } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: (prev) => ({
        ...prev,
        search: String(form.get("search") ?? ""),
        status: String(form.get("status") ?? "ACTIVE") as typeof prev.status,
        vendorId: String(form.get("vendorId") ?? "") || undefined,
        ownerMembershipId:
          String(form.get("ownerMembershipId") ?? "") || undefined,
        materialId: String(form.get("materialId") ?? "") || undefined,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
        page: 1,
      }),
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Deals"
        description="Commercial purchase agreements and their truck movements."
        actions={
          <Button render={<Link to="/app/deals/new" />} nativeButton={false}>
            <IconPlus data-icon="inline-start" />
            Create Deal
          </Button>
        }
      />
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={submit}
      >
        <Input
          name="search"
          defaultValue={search.search}
          placeholder="Deal, vendor, pickup, material, owner"
          aria-label="Search deals"
        />
        <NativeSelect
          name="status"
          defaultValue={search.status}
          aria-label="Deal status"
        >
          <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
          <NativeSelectOption value="ARCHIVED">Archived</NativeSelectOption>
          <NativeSelectOption value="ALL">All</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          name="vendorId"
          defaultValue={search.vendorId ?? ""}
          aria-label="Vendor filter"
        >
          <NativeSelectOption value="">All vendors</NativeSelectOption>
          {masters.vendors.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="ownerMembershipId"
          defaultValue={search.ownerMembershipId ?? ""}
          aria-label="Owner filter"
        >
          <NativeSelectOption value="">All owners</NativeSelectOption>
          {masters.members.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="materialId"
          defaultValue={search.materialId ?? ""}
          aria-label="Material filter"
        >
          <NativeSelectOption value="">All materials</NativeSelectOption>
          {masters.materials.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={search.from ?? ""}
          aria-label="Created from"
        />
        <Input
          type="date"
          name="to"
          defaultValue={search.to ?? ""}
          aria-label="Created to"
        />
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" />
          Search
        </Button>
      </form>
      <div className="flex flex-col gap-3 md:hidden">
        {data.items.map((deal) => (
          <Link
            key={deal.id}
            to="/app/deals/$dealId"
            params={{ dealId: deal.id }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{deal.dealNumber}</CardTitle>
                  <OperationsStatusBadge status={deal.status} />
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Vendor</span>
                  <br />
                  {deal.vendor}
                </p>
                <p>
                  <span className="text-muted-foreground">Material</span>
                  <br />
                  {deal.material}
                </p>
                <p>
                  <span className="text-muted-foreground">Pickup</span>
                  <br />
                  {deal.pickup}
                </p>
                <p>
                  <span className="text-muted-foreground">Trips</span>
                  <br />
                  {deal.tripsCount}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>Vendor / Pickup</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Rate / Qty</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Trips</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((deal) => (
              <TableRow key={deal.id}>
                <TableCell>
                  <Link
                    to="/app/deals/$dealId"
                    params={{ dealId: deal.id }}
                    className="font-medium"
                  >
                    {deal.dealNumber}
                  </Link>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(deal.createdAt)}
                  </span>
                </TableCell>
                <TableCell>
                  {deal.vendor}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {deal.pickup}
                  </span>
                </TableCell>
                <TableCell>{deal.material}</TableCell>
                <TableCell>
                  ₹{deal.purchaseRate}/t
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {deal.expectedQuantityMt
                      ? `${deal.expectedQuantityMt} t`
                      : "—"}
                  </span>
                </TableCell>
                <TableCell>{deal.owner}</TableCell>
                <TableCell>{deal.tripsCount}</TableCell>
                <TableCell>
                  <OperationsStatusBadge status={deal.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!data.items.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No Deals match these filters.
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.total} records</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={data.page * data.pageSize >= data.total}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
