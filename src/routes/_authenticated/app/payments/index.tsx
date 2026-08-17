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
import { formatDate, formatInr } from "@/lib/format"
import {
  getFinanceMastersFn,
  listPaymentsFn,
} from "@/server/finance/finance.functions"
import { paymentListSchema } from "@/server/finance/schemas"

export const Route = createFileRoute("/_authenticated/app/payments/")({
  validateSearch: paymentListSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [payments, masters] = await Promise.all([
      listPaymentsFn({ data: deps }),
      getFinanceMastersFn(),
    ])
    return { payments, masters }
  },
  component: PaymentsList,
})

function PaymentsList() {
  const { payments: data, masters } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: (prev) => ({
        ...prev,
        search: String(form.get("search") ?? ""),
        direction: String(
          form.get("direction") ?? "ALL"
        ) as typeof prev.direction,
        partyType: String(
          form.get("partyType") ?? "ALL"
        ) as typeof prev.partyType,
        type: String(form.get("type") ?? "ALL") as typeof prev.type,
        recordedByMembershipId:
          String(form.get("recordedByMembershipId") ?? "") || undefined,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
        page: 1,
      }),
    })
  }
  const party = (item: (typeof data.items)[number]) =>
    item.vendor ?? item.transporter ?? item.company ?? "—"
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Immutable posted payments, receipts, allocations, and reversals."
        actions={
          <Button
            render={<Link to="/app/payments/new" search={{}} />}
            nativeButton={false}
          >
            <IconPlus data-icon="inline-start" />
            Add Payment
          </Button>
        }
      />
      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          name="search"
          defaultValue={search.search}
          placeholder="Receipt, party, Deal, Trip…"
        />
        <NativeSelect name="direction" defaultValue={search.direction}>
          <NativeSelectOption value="ALL">All directions</NativeSelectOption>
          <NativeSelectOption value="OUTGOING">Outgoing</NativeSelectOption>
          <NativeSelectOption value="INCOMING">Incoming</NativeSelectOption>
        </NativeSelect>
        <NativeSelect name="partyType" defaultValue={search.partyType}>
          <NativeSelectOption value="ALL">All parties</NativeSelectOption>
          <NativeSelectOption value="VENDOR">Vendor</NativeSelectOption>
          <NativeSelectOption value="TRANSPORTER">
            Transporter
          </NativeSelectOption>
          <NativeSelectOption value="COMPANY">Company</NativeSelectOption>
        </NativeSelect>
        <NativeSelect name="type" defaultValue={search.type}>
          <NativeSelectOption value="ALL">All types</NativeSelectOption>
          {["ADVANCE", "PARTIAL", "FINAL", "ADJUSTMENT", "REFUND"].map(
            (value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            )
          )}
        </NativeSelect>
        <NativeSelect
          name="recordedByMembershipId"
          defaultValue={search.recordedByMembershipId ?? ""}
        >
          <NativeSelectOption value="">All recorders</NativeSelectOption>
          {masters.members.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={search.from ?? ""}
          aria-label="From"
        />
        <Input
          type="date"
          name="to"
          defaultValue={search.to ?? ""}
          aria-label="To"
        />
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" />
          Filter
        </Button>
      </form>
      <div className="grid gap-3 md:hidden">
        {data.items.map((item) => (
          <Link
            key={item.id}
            to="/app/payments/$paymentId"
            params={{ paymentId: item.id }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{formatInr(item.amount)}</CardTitle>
                  <OperationsStatusBadge status={item.status} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{party(item)}</p>
                <p className="text-sm text-muted-foreground">
                  {item.type} · {item.direction} ·{" "}
                  {formatDate(item.paymentDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.paymentNumber}
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
              <TableHead>Payment</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    to="/app/payments/$paymentId"
                    params={{ paymentId: item.id }}
                    className="font-medium"
                  >
                    {item.paymentNumber}
                  </Link>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.paymentDate)}
                  </span>
                </TableCell>
                <TableCell>{party(item)}</TableCell>
                <TableCell>
                  {formatInr(item.amount)}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {item.direction}
                  </span>
                </TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  {item.dealNumber ??
                    item.tripNumber ??
                    item.billNumber ??
                    "Unallocated"}
                </TableCell>
                <TableCell>{item.recordedBy}</TableCell>
                <TableCell>
                  <OperationsStatusBadge status={item.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!data.items.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No payments match these filters.
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
