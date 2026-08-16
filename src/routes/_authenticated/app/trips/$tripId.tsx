import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/lib/format"
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

export const Route = createFileRoute("/_authenticated/app/trips/$tripId")({
  loader: ({ params }) => getTripFn({ data: { id: params.tripId } }),
  component: TripDetail,
})
function TripDetail() {
  const trip = Route.useLoaderData()
  const router = useRouter()
  const startLoading = useServerFn(startLoadingFn)
  const confirmLoading = useServerFn(confirmLoadingFn)
  const startJourney = useServerFn(startJourneyFn)
  const confirmDelivery = useServerFn(confirmDeliveryFn)
  const cancel = useServerFn(cancelTripFn)
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
    await run(() =>
      confirmLoading({
        data: {
          id: trip.id,
          version: trip.version,
          loadedWeightMt: String(form.get("loadedWeightMt")),
          challanNumber: String(form.get("challanNumber") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      })
    )
  }
  async function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(() =>
      confirmDelivery({
        data: {
          id: trip.id,
          version: trip.version,
          challanNumber: String(form.get("challanNumber")),
          finalWeightMt: String(form.get("finalWeightMt")),
          weighmentCardNumber: String(form.get("weighmentCardNumber")),
        },
      })
    )
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
        </TabsContent>
        <TabsContent value="delivery">
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
