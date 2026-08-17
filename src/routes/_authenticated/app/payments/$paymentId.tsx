import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { DocumentCards } from "@/components/documents/document-cards"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatDateTime, formatInr } from "@/lib/format"
import {
  getPaymentFn,
  reversePaymentFn,
} from "@/server/finance/finance.functions"
import { listDocumentsForTargetFn } from "@/server/documents/document.functions"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/app/payments/$paymentId")(
  {
    loader: async ({ params }) => {
      const [payment, documents, customFields] = await Promise.all([
        getPaymentFn({ data: { id: params.paymentId } }),
        listDocumentsForTargetFn({
          data: { targetType: "PAYMENT", targetId: params.paymentId },
        }),
        getCustomFieldDataFn({
          data: { target: "PAYMENT", recordId: params.paymentId },
        }),
      ])
      return { payment, documents, customFields }
    },
    component: PaymentDetail,
  }
)
function PaymentDetail() {
  const { payment, documents, customFields } = Route.useLoaderData()
  const { auth } = Route.useRouteContext()
  const reverse = useServerFn(reversePaymentFn)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [key] = useState(() => crypto.randomUUID())
  const party = payment.vendor ?? payment.transporter ?? payment.company ?? "—"
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      await reverse({
        data: {
          id: payment.id,
          version: payment.version,
          idempotencyKey: key,
          reason: String(form.get("reason")),
        },
      })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reversal failed.")
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Payment"
        title={payment.paymentNumber}
        description={`${party} · ${formatInr(payment.amount)}`}
      />
      <OperationsStatusBadge status={payment.status} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Payment detail</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Amount", formatInr(payment.amount)],
              ["Direction", payment.direction],
              ["Party", party],
              ["Type", payment.type],
              ["Date", formatDate(payment.paymentDate)],
              ["Mode", payment.paymentMode.replaceAll("_", " ")],
              ["Receipt", payment.receiptNumber ?? "—"],
              ["Paid by", payment.paidBy ?? "—"],
              ["Recorded by", payment.recordedBy],
              ["Created", formatDateTime(payment.createdAt)],
              ["Status", payment.status],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {payment.notes ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {payment.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <DocumentUploadCard
        targetType="PAYMENT"
        targetId={payment.id}
        defaultDocumentType="PAYMENT_RECEIPT"
        onUploaded={() => router.invalidate({ sync: true })}
      />
      <DocumentCards items={documents} />
      <CustomFieldsPanel
        target="PAYMENT"
        recordId={payment.id}
        fields={customFields.fields}
      />
      <Card>
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {payment.allocations.map((allocation) => (
            <div
              key={allocation.id}
              className="flex justify-between gap-3 border-b py-2"
            >
              <span>
                {allocation.dealNumber ??
                  allocation.tripNumber ??
                  allocation.billNumber}
              </span>
              <span>{formatInr(allocation.amount)}</span>
            </div>
          ))}
          {!payment.allocations.length ? (
            <p className="text-sm text-muted-foreground">
              Unallocated payment.
            </p>
          ) : null}
        </CardContent>
      </Card>
      {payment.status === "REVERSED" ? (
        <Alert>
          <AlertTitle>REVERSED</AlertTitle>
          <AlertDescription>
            {payment.reversalReason ?? "This payment has a linked reversal."}
          </AlertDescription>
        </Alert>
      ) : null}
      {auth.membership.role === "ADMIN" && payment.status === "POSTED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Reverse Payment</CardTitle>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="reason">Reason *</FieldLabel>
                <Textarea id="reason" name="reason" required minLength={3} />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}Reverse
                Payment
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
