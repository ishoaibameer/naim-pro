import { Link, createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatInr } from "@/lib/format"
import { getTransporterFinanceFn } from "@/server/finance/finance.functions"

export const Route = createFileRoute(
  "/_authenticated/app/transporters/$transporterId"
)({
  loader: ({ params }) =>
    getTransporterFinanceFn({ data: { id: params.transporterId } }),
  component: TransporterFinance,
})
function TransporterFinance() {
  const data = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Transporter"
        title={data.name}
        description="Freight liability and outgoing payment position."
        actions={
          <Button
            render={
              <Link
                to="/app/payments/new"
                search={{ partyType: "TRANSPORTER", partyId: data.id }}
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
          ["Freight", data.freight],
          ["Paid", data.paid],
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
          <CardTitle>Trips</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.trips.map((trip) => (
            <Link
              key={trip.id}
              to="/app/trips/$tripId"
              params={{ tripId: trip.id }}
              className="flex justify-between border-b py-3"
            >
              <span>{trip.tripNumber}</span>
              <OperationsStatusBadge status={trip.status} />
            </Link>
          ))}
        </CardContent>
      </Card>
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
