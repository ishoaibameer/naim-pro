import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VendorEmpty } from "@/components/vendor/vendor-empty"
import { formatDate, formatInr } from "@/lib/format"
import { listVendorPaymentsFn } from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor/payments")({
  loader: () => listVendorPaymentsFn(),
  component: VendorPayments,
})

function VendorPayments() {
  const data = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vendor portal"
        title="Payments"
        description="Material value and payments recorded for your vendor account."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Material value", data.summary.totalMaterialValue],
          ["Received", data.summary.totalReceived],
          ["Pending", data.summary.pendingBalance],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">
                {formatInr(value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      {data.items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((payment) => (
            <Card key={payment.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{formatInr(payment.amount)}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {payment.paymentNumber}
                  </p>
                </div>
                <OperationsStatusBadge status={payment.status} />
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Date</dt>
                    <dd>{formatDate(payment.paymentDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Type</dt>
                    <dd>{payment.type.replaceAll("_", " ")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Receipt</dt>
                    <dd>{payment.receiptNumber ?? "Not recorded"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      Related load or deal
                    </dt>
                    <dd>
                      {payment.related.length
                        ? payment.related.join(", ")
                        : "Unallocated"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <VendorEmpty
          title="No payments yet"
          description="Payments recorded for your vendor account will appear here."
        />
      )}
    </div>
  )
}
