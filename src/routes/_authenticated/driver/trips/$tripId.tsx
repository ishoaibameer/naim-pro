import { createFileRoute, useRouter } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { DriverDocuments } from "@/components/driver/driver-documents"
import { DriverExpenses } from "@/components/driver/driver-expenses"
import { DriverPrimaryAction } from "@/components/driver/driver-primary-action"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, formatWeight } from "@/lib/format"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"
import { getDriverTripFn } from "@/server/driver/driver.functions"

export const Route = createFileRoute("/_authenticated/driver/trips/$tripId")({
  loader: async ({ params }) => {
    const [detail, loadingFields, deliveryFields] = await Promise.all([
      getDriverTripFn({ data: { id: params.tripId } }),
      getCustomFieldDataFn({
        data: { target: "TRIP_LOADING", recordId: params.tripId },
      }),
      getCustomFieldDataFn({
        data: { target: "TRIP_DELIVERY", recordId: params.tripId },
      }),
    ])
    return { detail, loadingFields, deliveryFields }
  },
  component: DriverTripDetail,
})

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "Not recorded"}</dd>
    </div>
  )
}

function DriverTripDetail() {
  const router = useRouter()
  const { detail, loadingFields, deliveryFields } = Route.useLoaderData()
  const trip = detail.trip
  const active = ["TRUCK_ASSIGNED", "LOADING", "LOADED", "IN_TRANSIT"].includes(
    trip.status
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="My trip"
        title={trip.vehicle ?? trip.tripNumber}
        description={trip.tripNumber}
        actions={<OperationsStatusBadge status={trip.status} />}
      />
      {!detail.isCurrentAssignment && active ? (
        <Alert>
          <AlertTitle>Trip reassigned</AlertTitle>
          <AlertDescription>
            You can view this Trip because it was previously assigned to you,
            but actions, expense changes, and uploads are disabled.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Route and load</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Route</dt>
              <dd className="text-lg font-semibold">
                {trip.pickup} → {trip.destination}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">
                Destination company
              </dt>
              <dd className="font-medium">{trip.company}</dd>
            </div>
            <Detail label="Material" value={trip.material} />
            <Detail label="Vehicle" value={trip.vehicle} />
            <Detail
              label="Loaded weight"
              value={
                trip.loadedWeightMt ? formatWeight(trip.loadedWeightMt) : null
              }
            />
            <Detail
              label="Final weight"
              value={
                trip.finalWeightMt ? formatWeight(trip.finalWeightMt) : null
              }
            />
            <Detail
              label="Dispatch time"
              value={formatDateTime(trip.dispatchedAt)}
            />
            <Detail label="Delivery challan" value={trip.challanNumber} />
          </dl>
        </CardContent>
      </Card>
      {detail.action ? (
        <DriverPrimaryAction
          action={detail.action}
          tripId={trip.id}
          version={trip.version}
        />
      ) : null}
      <CustomFieldsPanel
        target="TRIP_LOADING"
        recordId={trip.id}
        fields={loadingFields.fields}
        documentContentLinks
      />
      <CustomFieldsPanel
        target="TRIP_DELIVERY"
        recordId={trip.id}
        fields={deliveryFields.fields}
        documentContentLinks
      />
      {detail.isCurrentAssignment && active ? (
        <DocumentUploadCard
          targetType="TRIP"
          targetId={trip.id}
          documentTypes={["LOADING_PHOTO", "WEIGHBRIDGE_SLIP", "OTHER"]}
          title="Add Trip photo or proof"
          onUploaded={() => router.invalidate({ sync: true })}
        />
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Trip documents</h2>
        <DriverDocuments documents={detail.documents} />
      </section>
      <DriverExpenses
        tripId={trip.id}
        expenses={detail.expenses}
        canCreate={detail.isCurrentAssignment && active}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Trip updates</h2>
        {detail.timeline.length ? (
          <div className="flex flex-col gap-3">
            {detail.timeline.map((event) => (
              <Card key={event.id} size="sm">
                <CardHeader>
                  <CardTitle className="text-sm">{event.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </p>
                </CardHeader>
                {event.note || event.locationText ? (
                  <CardContent className="text-sm">
                    {event.locationText ? <p>{event.locationText}</p> : null}
                    {event.note ? (
                      <p className="text-muted-foreground">{event.note}</p>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Driver-safe updates yet.
          </p>
        )}
      </section>
    </div>
  )
}
