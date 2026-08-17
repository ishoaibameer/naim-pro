import { useState } from "react"
import type { FormEvent } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import {
  CustomFieldsPanel,
  DynamicFields,
  parseCustomFieldValues,
} from "@/components/custom-fields/dynamic-fields"
import { DocumentCards } from "@/components/documents/document-cards"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { DriverExpenseReview } from "@/components/operations/driver-expense-review"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatDateTime, formatInr } from "@/lib/format"
import {
  archiveTripFn,
  beginSettlementFn,
  completeSettlementFn,
  getTripFinanceFn,
  setTripFreightFn,
} from "@/server/finance/finance.functions"
import {
  cancelTripFn,
  confirmDeliveryFn,
  confirmLoadingFn,
  getTripFn,
  startJourneyFn,
  startLoadingFn,
} from "@/server/operations/operations.functions"
import {
  canCancelTrip,
  getTripPrimaryAction,
} from "@/server/operations/trip-state"
import { listDocumentsForTargetFn } from "@/server/documents/document.functions"
import { listOperationalDriverExpensesFn } from "@/server/driver/driver.functions"
import {
  getCustomFieldDataFn,
  saveCustomFieldValuesFn,
} from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/app/trips/$tripId")({
  loader: async ({ params }) => {
    const [
      trip,
      finance,
      documents,
      loadingFields,
      deliveryFields,
      driverExpenses,
    ] = await Promise.all([
      getTripFn({ data: { id: params.tripId } }),
      getTripFinanceFn({ data: { id: params.tripId } }),
      listDocumentsForTargetFn({
        data: { targetType: "TRIP", targetId: params.tripId },
      }),
      getCustomFieldDataFn({
        data: { target: "TRIP_LOADING", recordId: params.tripId },
      }),
      getCustomFieldDataFn({
        data: { target: "TRIP_DELIVERY", recordId: params.tripId },
      }),
      listOperationalDriverExpensesFn({ data: { id: params.tripId } }),
    ])
    return {
      trip,
      finance,
      documents,
      loadingFields,
      deliveryFields,
      driverExpenses,
    }
  },
  component: TripDetail,
})
function TripDetail() {
  const {
    trip,
    finance,
    documents,
    loadingFields,
    deliveryFields,
    driverExpenses,
  } = Route.useLoaderData()
  const { auth } = Route.useRouteContext()
  const router = useRouter()
  const startLoading = useServerFn(startLoadingFn)
  const confirmLoading = useServerFn(confirmLoadingFn)
  const startJourney = useServerFn(startJourneyFn)
  const confirmDelivery = useServerFn(confirmDeliveryFn)
  const cancel = useServerFn(cancelTripFn)
  const setFreight = useServerFn(setTripFreightFn)
  const beginSettlement = useServerFn(beginSettlementFn)
  const completeSettlement = useServerFn(completeSettlementFn)
  const archiveTrip = useServerFn(archiveTripFn)
  const saveCustomFields = useServerFn(saveCustomFieldValuesFn)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const action = getTripPrimaryAction(trip.status)
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
  async function submitLoading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(async () => {
      await saveCustomFields({
        data: {
          target: "TRIP_LOADING",
          recordId: trip.id,
          values: parseCustomFieldValues(form),
        },
      })
      return confirmLoading({
        data: {
          id: trip.id,
          version: trip.version,
          loadedWeightMt: String(form.get("loadedWeightMt")),
          challanNumber: String(form.get("challanNumber") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      })
    })
  }
  async function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(async () => {
      await saveCustomFields({
        data: {
          target: "TRIP_DELIVERY",
          recordId: trip.id,
          values: parseCustomFieldValues(form),
        },
      })
      return confirmDelivery({
        data: {
          id: trip.id,
          version: trip.version,
          challanNumber: String(form.get("challanNumber")),
          finalWeightMt: String(form.get("finalWeightMt")),
          weighmentCardNumber: String(form.get("weighmentCardNumber")),
        },
      })
    })
  }
  async function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(() =>
      cancel({
        data: {
          id: trip.id,
          version: trip.version,
          reason: String(form.get("reason")),
        },
      })
    )
  }
  async function submitFreight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(() =>
      setFreight({
        data: {
          id: trip.id,
          version: trip.version,
          amount: String(form.get("amount")),
        },
      })
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={trip.tripNumber}
        title={trip.vehicle ?? "Trip"}
        description={`${trip.vendor} → ${trip.company}`}
      />
      <div className="flex items-center gap-3">
        <OperationsStatusBadge status={trip.status} />
        {trip.weight?.hasWeightIssue ? (
          <OperationsStatusBadge status="WEIGHT ISSUE" />
        ) : null}
      </div>
      <ol className="grid grid-cols-6 gap-1 text-center text-xs">
        {["Deal", "Truck", "Loading", "Journey", "Delivery", "Settlement"].map(
          (stage, index) => (
            <li key={stage} className="border-b-2 py-2 text-muted-foreground">
              {index <
              [
                "CREATED",
                "TRUCK_ASSIGNED",
                "LOADING",
                "LOADED",
                "IN_TRANSIT",
                "DELIVERED",
                "SETTLEMENT_PENDING",
                "SETTLED",
              ].indexOf(trip.status)
                ? `${stage} ✓`
                : stage}
            </li>
          )
        )}
      </ol>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {action ? (
        <Card>
          <CardHeader>
            <CardTitle>Current stage</CardTitle>
            <CardDescription>
              Complete the next authorized action.
            </CardDescription>
          </CardHeader>
          {action === "START_LOADING" ? (
            <CardFooter>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    startLoading({
                      data: { id: trip.id, version: trip.version },
                    })
                  )
                }
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}Start
                Loading
              </Button>
            </CardFooter>
          ) : null}
          {action === "CONFIRM_LOADING" ? (
            <form onSubmit={submitLoading}>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="loadedWeightMt">
                      Loaded Weight (Ton) *
                    </FieldLabel>
                    <Input
                      id="loadedWeightMt"
                      name="loadedWeightMt"
                      inputMode="decimal"
                      placeholder="0.000"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="challanNumber">
                      Delivery Challan (optional now)
                    </FieldLabel>
                    <Input
                      id="challanNumber"
                      name="challanNumber"
                      defaultValue={trip.challanNumber ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="notes">Loading Notes</FieldLabel>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Vehicle photo and kanta parchi uploads are reserved for documents."
                    />
                  </Field>
                </FieldGroup>
                <DynamicFields
                  target="TRIP_LOADING"
                  recordId={trip.id}
                  fields={loadingFields.fields}
                  inputName="customFields"
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}Confirm
                  Loading
                </Button>
              </CardFooter>
            </form>
          ) : null}
          {action === "START_JOURNEY" ? (
            <CardFooter>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    startJourney({
                      data: { id: trip.id, version: trip.version },
                    })
                  )
                }
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}Start
                Journey
              </Button>
            </CardFooter>
          ) : null}
          {action === "CONFIRM_DELIVERY" ? (
            <form onSubmit={submitDelivery}>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="challanNumber">
                      Delivery Challan Number *
                    </FieldLabel>
                    <Input
                      id="challanNumber"
                      name="challanNumber"
                      defaultValue={trip.challanNumber ?? ""}
                      required
                    />
                  </Field>
                  <Field data-disabled>
                    <FieldLabel htmlFor="vehicle">Vehicle Number</FieldLabel>
                    <Input
                      id="vehicle"
                      value={trip.vehicle ?? ""}
                      disabled
                      readOnly
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="finalWeightMt">
                      Final Weight (Ton) *
                    </FieldLabel>
                    <Input
                      id="finalWeightMt"
                      name="finalWeightMt"
                      inputMode="decimal"
                      placeholder="0.000"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="weighmentCardNumber">
                      Weighment Card Number *
                    </FieldLabel>
                    <Input
                      id="weighmentCardNumber"
                      name="weighmentCardNumber"
                      required
                    />
                  </Field>
                </FieldGroup>
                <DynamicFields
                  target="TRIP_DELIVERY"
                  recordId={trip.id}
                  fields={deliveryFields.fields}
                  inputName="customFields"
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}Confirm
                  Delivery
                </Button>
              </CardFooter>
            </form>
          ) : null}
        </Card>
      ) : null}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="loading">Loading</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="expenses">Driver Expenses</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <p>
                {trip.pickup} → {trip.destination}
              </p>
              <p>Deal: {trip.dealNumber}</p>
              <p>Owner: {trip.owner}</p>
              <p>Created: {formatDateTime(trip.createdAt)}</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="assignment">
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <p>
                Vehicle
                <br />
                <strong>{trip.vehicle}</strong>
              </p>
              <p>
                Driver
                <br />
                <strong>{trip.driver}</strong>
              </p>
              <p>
                Transporter
                <br />
                <strong>{trip.transporter}</strong>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="loading">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Loading</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Loaded Weight:{" "}
                  {trip.loadedWeightMt ? `${trip.loadedWeightMt} t` : "—"}
                </p>
              </CardContent>
            </Card>
            <DocumentUploadCard
              targetType="TRIP"
              targetId={trip.id}
              documentTypes={["LOADING_PHOTO", "WEIGHBRIDGE_SLIP", "OTHER"]}
              defaultDocumentType="LOADING_PHOTO"
              title="Add loading evidence"
              onUploaded={() => router.invalidate({ sync: true })}
            />
            <CustomFieldsPanel
              target="TRIP_LOADING"
              recordId={trip.id}
              fields={loadingFields.fields}
            />
          </div>
        </TabsContent>
        <TabsContent value="delivery">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <p>Challan: {trip.challanNumber ?? "—"}</p>
                <p>Weighment Card: {trip.weighmentCardNumber ?? "—"}</p>
                <p>
                  Final Weight:{" "}
                  {trip.finalWeightMt ? `${trip.finalWeightMt} t` : "—"}
                </p>
                <p>Delivered: {formatDateTime(trip.deliveredAt)}</p>
              </CardContent>
            </Card>
            <DocumentUploadCard
              targetType="TRIP"
              targetId={trip.id}
              documentTypes={["DELIVERY_CHALLAN", "WEIGHBRIDGE_SLIP", "OTHER"]}
              defaultDocumentType="DELIVERY_CHALLAN"
              title="Add delivery proof (optional)"
              onUploaded={() => router.invalidate({ sync: true })}
            />
            <CustomFieldsPanel
              target="TRIP_DELIVERY"
              recordId={trip.id}
              fields={deliveryFields.fields}
            />
          </div>
        </TabsContent>
        <TabsContent value="weight">
          <Card>
            <CardHeader>
              <CardTitle>Weight Reconciliation</CardTitle>
            </CardHeader>
            <CardContent>
              {trip.weight ? (
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <dt>Loaded</dt>
                    <dd>{trip.weight.loadedWeightMt} t</dd>
                  </div>
                  <div>
                    <dt>Final</dt>
                    <dd>{trip.weight.finalWeightMt} t</dd>
                  </div>
                  <div>
                    <dt>Difference</dt>
                    <dd>{trip.weight.differenceMt} t</dd>
                  </div>
                  <div>
                    <dt>Difference %</dt>
                    <dd>{trip.weight.differencePercent}%</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Available after delivery.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="expenses">
          <DriverExpenseReview expenses={driverExpenses} />
        </TabsContent>
        <TabsContent value="settlement">
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>
                Operational delivery and financial settlement
              </AlertTitle>
              <AlertDescription>
                DELIVERED confirms the physical movement is complete. NAIM PRO
                keeps final SETTLED status blocked until Vendor pending,
                Transporter pending, and Company receivable are all zero.
              </AlertDescription>
            </Alert>
            <section className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Purchase</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p>Value: {formatInr(finance.purchase.materialValue)}</p>
                  <p>Deal paid: {formatInr(finance.purchase.paid)}</p>
                  <p className="font-semibold">
                    Deal pending: {formatInr(finance.purchase.pending)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Transport</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p>
                    Freight:{" "}
                    {finance.transport.freight
                      ? formatInr(finance.transport.freight)
                      : "—"}
                  </p>
                  <p>Paid: {formatInr(finance.transport.paid)}</p>
                  <p className="font-semibold">
                    Pending: {formatInr(finance.transport.pending)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Sale</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p>Billed: {formatInr(finance.sale.billed)}</p>
                  <p>Received: {formatInr(finance.sale.received)}</p>
                  <p className="font-semibold">
                    Receivable: {formatInr(finance.sale.receivable)}
                  </p>
                </CardContent>
              </Card>
            </section>
            <Card>
              <CardHeader>
                <CardTitle>Settlement readiness</CardTitle>
                <CardDescription>
                  {finance.readiness.ready
                    ? "All financial requirements are satisfied."
                    : "Resolve every blocker before final settlement."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {finance.readiness.blockers.map((blocker) => (
                  <p key={blocker} className="text-sm text-destructive">
                    • {blocker}
                  </p>
                ))}
                <div className="flex flex-wrap gap-2">
                  {trip.status !== "ARCHIVED" ? (
                    <Button
                      variant="outline"
                      render={
                        <Link
                          to="/app/payments/new"
                          search={{
                            partyType: "VENDOR",
                            partyId: trip.vendorId,
                            tripId: trip.id,
                          }}
                        />
                      }
                      nativeButton={false}
                    >
                      Add Vendor Payment
                    </Button>
                  ) : null}
                  {trip.status !== "ARCHIVED" && trip.transporterId ? (
                    <Button
                      variant="outline"
                      render={
                        <Link
                          to="/app/payments/new"
                          search={{
                            partyType: "TRANSPORTER",
                            partyId: trip.transporterId,
                            tripId: trip.id,
                          }}
                        />
                      }
                      nativeButton={false}
                    >
                      Add Transport Payment
                    </Button>
                  ) : null}
                  {finance.sale.billId ? (
                    <Button
                      variant="outline"
                      render={
                        <Link
                          to="/app/bills/$billId"
                          params={{ billId: finance.sale.billId }}
                        />
                      }
                      nativeButton={false}
                    >
                      View Bill
                    </Button>
                  ) : trip.status !== "ARCHIVED" ? (
                    <Button
                      variant="outline"
                      render={
                        <Link
                          to="/app/bills/new"
                          search={{ tripId: trip.id }}
                        />
                      }
                      nativeButton={false}
                    >
                      Create Bill
                    </Button>
                  ) : null}
                  {trip.status !== "ARCHIVED" &&
                  finance.sale.billId &&
                  finance.sale.billStatus === "ISSUED" ? (
                    <Button
                      variant="outline"
                      render={
                        <Link
                          to="/app/payments/new"
                          search={{
                            partyType: "COMPANY",
                            partyId: trip.companyId,
                            billId: finance.sale.billId,
                          }}
                        />
                      }
                      nativeButton={false}
                    >
                      Add Receipt
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            {!(["SETTLED", "ARCHIVED", "CANCELLED"] as string[]).includes(
              trip.status
            ) ? (
              <Card>
                <CardHeader>
                  <CardTitle>Agreed freight</CardTitle>
                </CardHeader>
                <form onSubmit={submitFreight}>
                  <CardContent>
                    <Field>
                      <FieldLabel htmlFor="freightAmount">
                        Total freight amount *
                      </FieldLabel>
                      <Input
                        id="freightAmount"
                        name="amount"
                        inputMode="decimal"
                        defaultValue={trip.agreedFreightAmount ?? ""}
                        required
                      />
                    </Field>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={pending}>
                      Save Freight
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {trip.status === "DELIVERED" ? (
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      beginSettlement({
                        data: { id: trip.id, version: trip.version },
                      })
                    )
                  }
                >
                  Begin Settlement
                </Button>
              ) : null}
              {auth.membership.role === "ADMIN" &&
              trip.status === "SETTLEMENT_PENDING" ? (
                <Button
                  disabled={pending || !finance.readiness.ready}
                  onClick={() =>
                    run(() =>
                      completeSettlement({
                        data: { id: trip.id, version: trip.version },
                      })
                    )
                  }
                >
                  Complete Settlement
                </Button>
              ) : null}
              {auth.membership.role === "ADMIN" && trip.status === "SETTLED" ? (
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      archiveTrip({
                        data: { id: trip.id, version: trip.version },
                      })
                    )
                  }
                >
                  Archive Trip
                </Button>
              ) : null}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
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
                    No payments allocated directly to this Trip.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {trip.events.map((event) => (
                <div key={event.id} className="border-b py-2">
                  <p>{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documents">
          <div className="flex flex-col gap-4">
            <DocumentUploadCard
              targetType="TRIP"
              targetId={trip.id}
              defaultDocumentType="LOADING_PHOTO"
              onUploaded={() => router.invalidate({ sync: true })}
            />
            <DocumentCards items={documents} />
          </div>
        </TabsContent>
      </Tabs>
      {canCancelTrip(trip.status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancel Trip</CardTitle>
            <CardDescription>
              Cancellation is terminal and only allowed before dispatch.
            </CardDescription>
          </CardHeader>
          <form onSubmit={submitCancel}>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="reason">Cancellation Reason *</FieldLabel>
                <Textarea id="reason" name="reason" required minLength={3} />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="destructive" disabled={pending}>
                Cancel Trip
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
