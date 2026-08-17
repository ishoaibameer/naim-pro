import { useState } from "react"
import type { FormEvent } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { IconPlus } from "@tabler/icons-react"

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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  formatDate,
  formatDateTime,
  formatInr,
  formatWeight,
} from "@/lib/format"
import {
  closeDealFn,
  getDealFinanceFn,
} from "@/server/finance/finance.functions"
import {
  getDealFn,
  getOperationalMastersFn,
  reassignDealOwnerFn,
} from "@/server/operations/operations.functions"
import { listDocumentsForTargetFn } from "@/server/documents/document.functions"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/app/deals/$dealId")({
  loader: async ({ params }) => {
    const [deal, finance, documents, customFields, masters] = await Promise.all(
      [
        getDealFn({ data: { id: params.dealId } }),
        getDealFinanceFn({ data: { id: params.dealId } }),
        listDocumentsForTargetFn({
          data: { targetType: "DEAL", targetId: params.dealId },
        }),
        getCustomFieldDataFn({
          data: { target: "DEAL", recordId: params.dealId },
        }),
        getOperationalMastersFn(),
      ]
    )
    return { deal, finance, documents, customFields, masters }
  },
  component: DealDetail,
})

function DealDetail() {
  const { deal, finance, documents, customFields, masters } =
    Route.useLoaderData()
  const { operationsAuth } = Route.useRouteContext()
  const closeDeal = useServerFn(closeDealFn)
  const reassignOwner = useServerFn(reassignDealOwnerFn)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [ownerPending, setOwnerPending] = useState(false)
  const [error, setError] = useState("")
  const isAdmin = operationsAuth.membership.role === "ADMIN"

  async function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError("")
    try {
      await closeDeal({
        data: {
          id: deal.id,
          version: deal.version,
          reason: String(form.get("reason")),
        },
      })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Deal could not be closed."
      )
    } finally {
      setPending(false)
    }
  }

  async function submitOwnerReassignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setOwnerPending(true)
    setError("")
    try {
      await reassignOwner({
        data: {
          id: deal.id,
          version: deal.version,
          ownerMembershipId: String(form.get("ownerMembershipId")),
        },
      })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Deal owner could not be reassigned."
      )
    } finally {
      setOwnerPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Deal"
        title={deal.dealNumber}
        description={`${deal.vendor} · ${deal.material}`}
        actions={
          deal.status === "ACTIVE" ? (
            <Button
              render={
                <Link
                  to="/app/deals/$dealId/trips/new"
                  params={{ dealId: deal.id }}
                />
              }
              nativeButton={false}
            >
              <IconPlus data-icon="inline-start" />
              Add Truck
            </Button>
          ) : undefined
        }
      />
      <OperationsStatusBadge status={deal.status} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Purchase Pending", finance.purchase.pending],
          ["Transport Pending", finance.transport.pending],
          ["Company Receivable", finance.sale.receivable],
        ].map(([label, amount]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {formatInr(amount)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Vendor", deal.vendor],
                  ["Pickup", deal.pickup],
                  ["Material", deal.material],
                  ["Rate", `${formatInr(deal.purchaseRate)}/t`],
                  [
                    "Expected Quantity",
                    deal.expectedQuantityMt
                      ? `${deal.expectedQuantityMt} t`
                      : "—",
                  ],
                  ["Owner", deal.owner],
                  ["Created by", deal.createdBy],
                  ["Created at", formatDateTime(deal.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase">
                      {label}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {deal.notes ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  {deal.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <CustomFieldsPanel
            target="DEAL"
            recordId={deal.id}
            fields={customFields.fields}
          />
          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Reassign Owner</CardTitle>
                <CardDescription>
                  Assign this Deal to another active member.
                </CardDescription>
              </CardHeader>
              <form onSubmit={submitOwnerReassignment}>
                <CardContent>
                  <Field>
                    <FieldLabel htmlFor="reassignOwnerMembershipId">
                      Owner Member *
                    </FieldLabel>
                    <NativeSelect
                      id="reassignOwnerMembershipId"
                      name="ownerMembershipId"
                      defaultValue={deal.ownerMembershipId}
                      required
                      className="w-full"
                    >
                      <NativeSelectOption value="">
                        Select member
                      </NativeSelectOption>
                      {masters.members.map((member) => (
                        <NativeSelectOption key={member.id} value={member.id}>
                          {member.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={ownerPending}>
                    {ownerPending ? <Spinner data-icon="inline-start" /> : null}
                    Reassign Owner
                  </Button>
                </CardFooter>
              </form>
            </Card>
          ) : null}
        </TabsContent>
        <TabsContent value="trips">
          <section
            className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-label="Deal Trip summary"
          >
            {[
              ["Active Trips", deal.tripSummary.active],
              ["Completed Trips", deal.tripSummary.completed],
              ["Cancelled Trips", deal.tripSummary.cancelled],
              [
                "Delivered Quantity",
                formatWeight(deal.tripSummary.deliveredQuantityMt),
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Trips</CardTitle>
              <CardDescription>
                One Deal may have many truck movements.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deal.trips.length ? (
                deal.trips.map((trip) => (
                  <Link
                    key={trip.id}
                    to="/app/trips/$tripId"
                    params={{ tripId: trip.id }}
                    className="flex items-center justify-between border-b py-3"
                  >
                    <span>{trip.tripNumber}</span>
                    <OperationsStatusBadge status={trip.status} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trucks assigned yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Vendor payments allocated to this Deal or its Trips.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                className="self-start"
                render={
                  <Link
                    to="/app/payments/new"
                    search={{
                      partyType: "VENDOR",
                      partyId: deal.vendorId,
                      dealId: deal.id,
                    }}
                  />
                }
                nativeButton={false}
              >
                Add Vendor Payment
              </Button>
              {finance.recentPayments.map((payment) => (
                <Link
                  key={payment.id}
                  to="/app/payments/$paymentId"
                  params={{ paymentId: payment.id }}
                  className="flex justify-between gap-3 border-b py-3"
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
              {!finance.recentPayments.length ? (
                <p className="text-sm text-muted-foreground">
                  No allocated payments yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documents">
          <div className="flex flex-col gap-4">
            <DocumentUploadCard
              targetType="DEAL"
              targetId={deal.id}
              onUploaded={() => router.invalidate({ sync: true })}
            />
            <DocumentCards items={documents} />
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Recorded Deal actions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deal.events.map((event) => (
                <div key={event.id} className="border-b py-2">
                  <p>{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
              ))}
              {!deal.events.length ? (
                <p className="text-sm text-muted-foreground">
                  No Deal activity recorded.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {deal.status === "ACTIVE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Close Deal</CardTitle>
            <CardDescription>
              Closing is manual and never inferred from expected quantity. All
              non-cancelled Trips must be settled or archived.
            </CardDescription>
          </CardHeader>
          <form onSubmit={submitClose}>
            <CardContent>
              {deal.tripSummary.closeBlockers.length ? (
                <Alert>
                  <AlertTitle>Closure blockers</AlertTitle>
                  <AlertDescription>
                    {deal.tripSummary.closeBlockers.slice(0, 5).join(" · ")}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTitle>Ready to close</AlertTitle>
                  <AlertDescription>
                    All non-cancelled Trips are financially settled or archived.
                  </AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="reason">Closure reason *</FieldLabel>
                <Textarea id="reason" name="reason" minLength={3} required />
              </Field>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={pending || deal.tripSummary.closeBlockers.length > 0}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Close Deal
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
