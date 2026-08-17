import { Link, createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatInr } from "@/lib/format"
import { getVendorFinanceFn } from "@/server/finance/finance.functions"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/app/vendors/$vendorId")({
  loader: async ({ params }) => {
    const [vendor, customFields] = await Promise.all([
      getVendorFinanceFn({ data: { id: params.vendorId } }),
      getCustomFieldDataFn({
        data: { target: "VENDOR", recordId: params.vendorId },
      }),
    ])
    return { vendor, customFields }
  },
  component: VendorFinance,
})
function VendorFinance() {
  const { vendor: data, customFields } = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vendor"
        title={data.name}
        description="Purchase value and outgoing payment position."
        actions={
          <Button
            render={
              <Link
                to="/app/payments/new"
                search={{ partyType: "VENDOR", partyId: data.id }}
              />
            }
            nativeButton={false}
          >
            Add Payment
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Purchased", data.totalPurchased],
          ["Paid", data.totalPaid],
          ["Pending", data.pending],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatInr(value)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Deals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.deals.map((deal) => (
            <Link
              key={deal.id}
              to="/app/deals/$dealId"
              params={{ dealId: deal.id }}
              className="flex justify-between border-b py-3"
            >
              <span>{deal.dealNumber}</span>
              <OperationsStatusBadge status={deal.status} />
            </Link>
          ))}
        </CardContent>
      </Card>
      <CustomFieldsPanel
        target="VENDOR"
        recordId={data.id}
        fields={customFields.fields}
      />
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.recentPayments.map((payment) => (
            <Link
              key={payment.id}
              to="/app/payments/$paymentId"
              params={{ paymentId: payment.id }}
              className="flex justify-between border-b py-3"
            >
              <span>
                {payment.paymentNumber}
                <br />
                <span className="text-xs text-muted-foreground">
                  {formatDate(payment.paymentDate)} · {payment.status}
                </span>
              </span>
              <span>{formatInr(payment.amount)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
