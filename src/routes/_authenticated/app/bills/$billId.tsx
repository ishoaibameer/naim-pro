import { useState } from "react"
import type { FormEvent } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
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
  getBillFn,
  issueBillFn,
  voidBillFn,
} from "@/server/finance/finance.functions"
import { listDocumentsForTargetFn } from "@/server/documents/document.functions"

export const Route = createFileRoute("/_authenticated/app/bills/$billId")({
  loader: async ({ params }) => {
    const [bill, documents] = await Promise.all([
      getBillFn({ data: { id: params.billId } }),
      listDocumentsForTargetFn({
        data: { targetType: "BILL", targetId: params.billId },
      }),
    ])
    return { bill, documents }
  },
  component: BillDetail,
})
function BillDetail() {
  const { bill, documents } = Route.useLoaderData()
  const { auth } = Route.useRouteContext()
  const issue = useServerFn(issueBillFn)
  const voidBill = useServerFn(voidBillFn)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function run(task: () => Promise<unknown>) {
    setPending(true)
    setError("")
    try {
      await task()
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.")
    } finally {
      setPending(false)
    }
  }
  async function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(() =>
      voidBill({
        data: {
          id: bill.id,
          version: bill.version,
          reason: String(form.get("reason")),
        },
      })
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Bill"
        title={bill.billNumber}
        description={`${bill.company} · ${formatInr(bill.totalAmount)}`}
        actions={
          bill.status === "ISSUED" ? (
            <Button
              render={
                <Link
                  to="/app/payments/new"
                  search={{
                    partyType: "COMPANY",
                    partyId: bill.companyId,
                    billId: bill.id,
                  }}
                />
              }
              nativeButton={false}
            >
              Add Receipt
            </Button>
          ) : undefined
        }
      />
      <OperationsStatusBadge status={bill.status} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Bill detail</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Company", bill.company],
              ["Bill date", formatDate(bill.billDate)],
              ["Amount", formatInr(bill.totalAmount)],
              ["Status", bill.status],
              ["Issued", formatDateTime(bill.issuedAt)],
              ["Created", formatDateTime(bill.createdAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {bill.notes ? (
            <p className="mt-6 text-sm text-muted-foreground">{bill.notes}</p>
          ) : null}
        </CardContent>
      </Card>
      <DocumentUploadCard
        targetType="BILL"
        targetId={bill.id}
        defaultDocumentType="BILL"
        onUploaded={() => router.invalidate({ sync: true })}
      />
      <DocumentCards items={documents} />
      <Card>
        <CardHeader>
          <CardTitle>Trip lines</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bill.lines.map((line) => (
            <Link
              key={line.id}
              to="/app/trips/$tripId"
              params={{ tripId: line.tripId }}
              className="flex justify-between gap-3 border-b py-3"
            >
              <span>
                {line.vehicle} · {line.tripNumber}
                <br />
                <span className="text-xs text-muted-foreground">
                  {line.quantityMt} t
                </span>
              </span>
              <span>{formatInr(line.lineAmount)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
      {auth.membership.role === "ADMIN" && bill.status === "DRAFT" ? (
        <Button
          disabled={pending}
          onClick={() =>
            run(() => issue({ data: { id: bill.id, version: bill.version } }))
          }
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}Issue Bill
        </Button>
      ) : null}
      {auth.membership.role === "ADMIN" && bill.status !== "VOID" ? (
        <Card>
          <CardHeader>
            <CardTitle>Void Bill</CardTitle>
          </CardHeader>
          <form onSubmit={submitVoid}>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="reason">Reason *</FieldLabel>
                <Textarea id="reason" name="reason" required minLength={3} />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="destructive" disabled={pending}>
                Void Bill
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
      {bill.status === "VOID" ? (
        <Alert>
          <AlertTitle>VOID</AlertTitle>
          <AlertDescription>{bill.voidReason}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
