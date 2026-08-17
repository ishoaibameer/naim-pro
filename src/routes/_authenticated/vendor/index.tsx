import { Link, createFileRoute } from "@tanstack/react-router"
import { IconArrowRight } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VendorDocumentCards } from "@/components/vendor/vendor-document-cards"
import { VendorEmpty } from "@/components/vendor/vendor-empty"
import { VendorLoadCard } from "@/components/vendor/vendor-load-card"
import { formatDate, formatInr } from "@/lib/format"
import { getVendorHomeFn } from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor/")({
  loader: () => getVendorHomeFn(),
  component: VendorHome,
})

function SectionHeading({
  title,
  to,
}: {
  title: string
  to: "/vendor/loads" | "/vendor/payments" | "/vendor/documents"
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button
        variant="ghost"
        size="sm"
        render={<Link to={to} />}
        nativeButton={false}
      >
        View all
        <IconArrowRight data-icon="inline-end" />
      </Button>
    </div>
  )
}

function VendorHome() {
  const data = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Vendor portal"
        title={`Welcome, ${data.vendor.name}`}
        description="Your loads, payments, and documents in one place."
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Active loads", data.counts.active],
          ["In transit", data.counts.inTransit],
          ["Delivered", data.counts.delivered],
          ["Payment pending", formatInr(data.paymentPending)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading title="Recent loads" to="/vendor/loads" />
        {data.recentLoads.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.recentLoads.map((load) => (
              <VendorLoadCard key={load.id} load={load} />
            ))}
          </div>
        ) : (
          <VendorEmpty
            title="No loads yet"
            description="Your assigned loads will appear here."
          />
        )}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading title="Recent payments" to="/vendor/payments" />
        {data.recentPayments.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.recentPayments.map((payment) => (
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
                <CardContent className="text-sm">
                  <p>{payment.type.replaceAll("_", " ")}</p>
                  <p className="text-muted-foreground">
                    {formatDate(payment.paymentDate)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <VendorEmpty
            title="No payments yet"
            description="Payments recorded for your account will appear here."
          />
        )}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading title="Recent documents" to="/vendor/documents" />
        <VendorDocumentCards documents={data.recentDocuments} />
      </section>
    </div>
  )
}
