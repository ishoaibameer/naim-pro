import { Link, createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatInr } from "@/lib/format"
import { getCompanyFinanceFn } from "@/server/finance/finance.functions"

export const Route = createFileRoute(
  "/_authenticated/app/companies/$companyId"
)({
  loader: ({ params }) =>
    getCompanyFinanceFn({ data: { id: params.companyId } }),
  component: CompanyFinance,
})
function CompanyFinance() {
  const data = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Company"
        title={data.name}
        description="Issued billing, incoming receipts, and receivables."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Billed", data.billed],
          ["Received", data.received],
          ["Receivable", data.receivable],
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
          <CardTitle>Recent Bills</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.recentBills.map((bill) => (
            <div
              key={bill.id}
              className="flex items-center justify-between gap-3 border-b py-3"
            >
              <Link to="/app/bills/$billId" params={{ billId: bill.id }}>
                {bill.billNumber}
                <br />
                <span className="text-xs text-muted-foreground">
                  {formatDate(bill.billDate)} · {bill.status}
                </span>
              </Link>
              {bill.status === "ISSUED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      to="/app/payments/new"
                      search={{
                        partyType: "COMPANY",
                        partyId: data.id,
                        billId: bill.id,
                      }}
                    />
                  }
                  nativeButton={false}
                >
                  Add Receipt
                </Button>
              ) : (
                <span>{formatInr(bill.totalAmount)}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent Receipts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.recentReceipts.map((payment) => (
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
