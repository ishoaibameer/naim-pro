import type { FormEvent, ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { IconDownload, IconFilter } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import {
  formatDate,
  formatInr,
  formatPercent,
  formatWeight,
} from "@/lib/format"
import type { getReportMasters } from "@/server/product/reports.server"
import { reportFilterSchema } from "@/server/product/schemas"
import type { ReportFilterInput } from "@/server/product/schemas"
import type { AwaitedReport } from "@/server/product/types"

type Masters = Awaited<ReturnType<typeof getReportMasters>>
type Option = { id: string; label: string }

function Options({ items }: { items: Option[] }) {
  return items.map((item) => (
    <NativeSelectOption key={item.id} value={item.id}>
      {item.label}
    </NativeSelectOption>
  ))
}

function ReportFilters({
  filters,
  masters,
}: {
  filters: ReportFilterInput
  masters: Masters
}) {
  const navigate = useNavigate({ from: "/app/reports" })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = reportFilterSchema.parse(Object.fromEntries(form))
    void navigate({
      search: parsed,
    })
  }
  const payment = filters.report === "PAYMENTS"
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report filters</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="report-type">Report</FieldLabel>
              <NativeSelect
                id="report-type"
                name="report"
                defaultValue={filters.report}
              >
                <NativeSelectOption value="TRIPS">
                  Trip Report
                </NativeSelectOption>
                <NativeSelectOption value="VENDORS">
                  Vendor Report
                </NativeSelectOption>
                <NativeSelectOption value="TRANSPORTERS">
                  Transporter Report
                </NativeSelectOption>
                <NativeSelectOption value="COMPANIES">
                  Company Report
                </NativeSelectOption>
                <NativeSelectOption value="PAYMENTS">
                  Payment Report
                </NativeSelectOption>
                <NativeSelectOption value="WEIGHT">
                  Weight Difference Report
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="report-from">From</FieldLabel>
              <Input
                id="report-from"
                name="from"
                type="date"
                defaultValue={filters.from ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="report-to">To</FieldLabel>
              <Input
                id="report-to"
                name="to"
                type="date"
                defaultValue={filters.to ?? ""}
              />
            </Field>
            {payment ? (
              <>
                <Field>
                  <FieldLabel htmlFor="report-party-type">
                    Party type
                  </FieldLabel>
                  <NativeSelect
                    id="report-party-type"
                    name="partyType"
                    defaultValue={filters.partyType}
                  >
                    <NativeSelectOption value="ALL">
                      All parties
                    </NativeSelectOption>
                    <NativeSelectOption value="VENDOR">
                      Vendor
                    </NativeSelectOption>
                    <NativeSelectOption value="TRANSPORTER">
                      Transporter
                    </NativeSelectOption>
                    <NativeSelectOption value="COMPANY">
                      Company
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-direction">Direction</FieldLabel>
                  <NativeSelect
                    id="report-direction"
                    name="direction"
                    defaultValue={filters.direction}
                  >
                    <NativeSelectOption value="ALL">
                      All directions
                    </NativeSelectOption>
                    <NativeSelectOption value="OUTGOING">
                      Outgoing
                    </NativeSelectOption>
                    <NativeSelectOption value="INCOMING">
                      Incoming
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-payment-type">
                    Payment type
                  </FieldLabel>
                  <NativeSelect
                    id="report-payment-type"
                    name="paymentType"
                    defaultValue={filters.paymentType}
                  >
                    <NativeSelectOption value="ALL">
                      All types
                    </NativeSelectOption>
                    <NativeSelectOption value="ADVANCE">
                      Advance
                    </NativeSelectOption>
                    <NativeSelectOption value="PARTIAL">
                      Partial
                    </NativeSelectOption>
                    <NativeSelectOption value="FINAL">Final</NativeSelectOption>
                    <NativeSelectOption value="REFUND">
                      Refund
                    </NativeSelectOption>
                    <NativeSelectOption value="ADJUSTMENT">
                      Adjustment
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-member">Recorded by</FieldLabel>
                  <NativeSelect
                    id="report-member"
                    name="memberId"
                    defaultValue={filters.memberId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All members
                    </NativeSelectOption>
                    <Options items={masters.members} />
                  </NativeSelect>
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="report-status">Trip status</FieldLabel>
                  <NativeSelect
                    id="report-status"
                    name="status"
                    defaultValue={filters.status}
                  >
                    <NativeSelectOption value="ALL">
                      All statuses
                    </NativeSelectOption>
                    {[
                      "CREATED",
                      "TRUCK_ASSIGNED",
                      "LOADING",
                      "LOADED",
                      "IN_TRANSIT",
                      "DELIVERED",
                      "SETTLEMENT_PENDING",
                      "SETTLED",
                      "ARCHIVED",
                      "CANCELLED",
                    ].map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-vendor">Vendor</FieldLabel>
                  <NativeSelect
                    id="report-vendor"
                    name="vendorId"
                    defaultValue={filters.vendorId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All vendors
                    </NativeSelectOption>
                    <Options items={masters.vendors} />
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-vehicle">Vehicle</FieldLabel>
                  <NativeSelect
                    id="report-vehicle"
                    name="vehicleId"
                    defaultValue={filters.vehicleId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All vehicles
                    </NativeSelectOption>
                    <Options items={masters.vehicles} />
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-driver">Driver</FieldLabel>
                  <NativeSelect
                    id="report-driver"
                    name="driverId"
                    defaultValue={filters.driverId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All drivers
                    </NativeSelectOption>
                    <Options items={masters.drivers} />
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-transporter">
                    Transporter
                  </FieldLabel>
                  <NativeSelect
                    id="report-transporter"
                    name="transporterId"
                    defaultValue={filters.transporterId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All transporters
                    </NativeSelectOption>
                    <Options items={masters.transporters} />
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-company">Company</FieldLabel>
                  <NativeSelect
                    id="report-company"
                    name="companyId"
                    defaultValue={filters.companyId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All companies
                    </NativeSelectOption>
                    <Options items={masters.companies} />
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-pickup">Pickup</FieldLabel>
                  <NativeSelect
                    id="report-pickup"
                    name="pickupId"
                    defaultValue={filters.pickupId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All pickup locations
                    </NativeSelectOption>
                    <Options items={masters.pickupLocations} />
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="report-destination">
                    Destination
                  </FieldLabel>
                  <NativeSelect
                    id="report-destination"
                    name="destinationId"
                    defaultValue={filters.destinationId ?? ""}
                  >
                    <NativeSelectOption value="">
                      All destinations
                    </NativeSelectOption>
                    <Options items={masters.destinationLocations} />
                  </NativeSelect>
                </Field>
                {filters.report === "WEIGHT" ? (
                  <Field>
                    <FieldLabel htmlFor="report-difference">
                      Minimum difference %
                    </FieldLabel>
                    <Input
                      id="report-difference"
                      name="minDifferencePct"
                      type="number"
                      min="0"
                      max="100"
                      step="0.001"
                      defaultValue={filters.minDifferencePct}
                    />
                  </Field>
                ) : null}
              </>
            )}
          </FieldGroup>
          <Button type="submit" variant="outline" className="mt-4">
            <IconFilter data-icon="inline-start" />
            Apply filters
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type Column<T> = {
  key: keyof T
  label: string
  render?: (value: T[keyof T], row: T) => ReactNode
}
function ReportRows<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[]
  columns: Column<T>[]
}) {
  if (!rows.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No report data</EmptyTitle>
          <EmptyDescription>
            Adjust the filters or date range and try again.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id} size="sm">
            <CardContent className="grid grid-cols-2 gap-3">
              {columns.map((column) => (
                <div key={String(column.key)} className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {column.label}
                  </p>
                  <div className="font-medium break-words">
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? "—")}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={String(column.key)}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function money(value: unknown) {
  return formatInr(value === null ? null : String(value))
}
function weight(value: unknown) {
  return formatWeight(value === null ? null : String(value))
}
function date(value: unknown) {
  return formatDate(value as Date | string | null)
}

function ReportResult({ report }: { report: AwaitedReport }) {
  if (report.type === "TRIPS")
    return (
      <ReportRows
        rows={report.rows}
        columns={[
          { key: "tripNumber", label: "Trip" },
          { key: "vehicle", label: "Vehicle" },
          { key: "vendor", label: "Vendor" },
          { key: "company", label: "Company" },
          { key: "loadedWeightMt", label: "Loaded", render: weight },
          { key: "finalWeightMt", label: "Final", render: weight },
          { key: "differenceMt", label: "Difference", render: weight },
          {
            key: "status",
            label: "Status",
            render: (value) => <OperationsStatusBadge status={String(value)} />,
          },
          { key: "dispatchedAt", label: "Dispatch", render: date },
          { key: "deliveredAt", label: "Delivery", render: date },
        ]}
      />
    )
  if (report.type === "VENDORS")
    return (
      <ReportRows
        rows={report.rows}
        columns={[
          { key: "vendor", label: "Vendor" },
          { key: "trips", label: "Trips" },
          { key: "deliveredWeightMt", label: "Delivered", render: weight },
          { key: "materialValue", label: "Material value", render: money },
          { key: "paid", label: "Paid", render: money },
          { key: "pending", label: "Pending", render: money },
        ]}
      />
    )
  if (report.type === "TRANSPORTERS")
    return (
      <ReportRows
        rows={report.rows}
        columns={[
          { key: "transporter", label: "Transporter" },
          { key: "trips", label: "Trips" },
          { key: "freight", label: "Freight", render: money },
          { key: "paid", label: "Paid", render: money },
          { key: "pending", label: "Pending", render: money },
        ]}
      />
    )
  if (report.type === "COMPANIES")
    return (
      <ReportRows
        rows={report.rows}
        columns={[
          { key: "company", label: "Company" },
          { key: "tripsDelivered", label: "Trips" },
          { key: "finalWeightMt", label: "Final tonnage", render: weight },
          { key: "billed", label: "Billed", render: money },
          { key: "received", label: "Received", render: money },
          { key: "receivable", label: "Receivable", render: money },
        ]}
      />
    )
  if (report.type === "PAYMENTS")
    return (
      <ReportRows
        rows={report.rows}
        columns={[
          { key: "paymentDate", label: "Date", render: date },
          { key: "party", label: "Party" },
          { key: "amount", label: "Amount", render: money },
          { key: "direction", label: "Direction" },
          { key: "type", label: "Type" },
          { key: "recordedBy", label: "Recorded by" },
          { key: "receipt", label: "Receipt" },
        ]}
      />
    )
  return (
    <ReportRows
      rows={report.rows}
      columns={[
        { key: "tripNumber", label: "Trip" },
        { key: "vehicle", label: "Vehicle" },
        { key: "vendor", label: "Vendor" },
        { key: "loadedWeightMt", label: "Loaded", render: weight },
        { key: "finalWeightMt", label: "Final", render: weight },
        { key: "differenceMt", label: "Difference", render: weight },
        {
          key: "differencePct",
          label: "Difference %",
          render: (value) => formatPercent(String(value)),
        },
        { key: "deliveredAt", label: "Delivered", render: date },
      ]}
    />
  )
}

export function ReportsPage({
  report,
  masters,
  filters,
}: {
  report: AwaitedReport
  masters: Masters
  filters: ReportFilterInput
}) {
  const exportParams = new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, String(value)])
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Operational and financial reports scoped to your organization."
        actions={
          <Button
            render={<a href={`/api/reports/export?${exportParams}`} />}
            nativeButton={false}
            variant="outline"
          >
            <IconDownload data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />
      <ReportFilters filters={filters} masters={masters} />
      <Card>
        <CardHeader>
          <CardTitle>
            {filters.report.replaceAll("_", " ")} · {report.rows.length} rows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReportResult report={report} />
        </CardContent>
      </Card>
    </div>
  )
}
