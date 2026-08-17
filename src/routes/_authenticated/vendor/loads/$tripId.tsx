import { createFileRoute, useRouter } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VendorDocumentCards } from "@/components/vendor/vendor-document-cards"
import { formatDate, formatInr, formatWeight } from "@/lib/format"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"
import {
  getVendorLoadFn,
  listVendorDocumentsFn,
} from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor/loads/$tripId")({
  loader: async ({ params }) => {
    const [load, loadingFields, deliveryFields, documents] = await Promise.all([
      getVendorLoadFn({ data: { id: params.tripId } }),
      getCustomFieldDataFn({
        data: { target: "TRIP_LOADING", recordId: params.tripId },
      }),
      getCustomFieldDataFn({
        data: { target: "TRIP_DELIVERY", recordId: params.tripId },
      }),
      listVendorDocumentsFn({
        data: { tripId: params.tripId, documentType: "ALL" },
      }),
    ])
    return { load, loadingFields, deliveryFields, documents }
  },
  component: VendorLoadDetail,
})

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "Not recorded"}</dd>
    </div>
  )
}

function VendorLoadDetail() {
  const router = useRouter()
  const { load, loadingFields, deliveryFields, documents } =
    Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="My loads"
        title={load.vehicle ?? load.tripNumber}
        description={`${load.tripNumber} · ${load.material}`}
        actions={<OperationsStatusBadge status={load.status} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Movement</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Detail label="Pickup" value={load.pickup} />
              <Detail label="Destination" value={load.destination} />
              <Detail label="Driver" value={load.driver} />
              <Detail label="Vehicle" value={load.vehicle} />
              <Detail
                label="Dispatched"
                value={formatDate(load.dispatchedAt)}
              />
              <Detail label="Delivered" value={formatDate(load.deliveredAt)} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weight and purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Detail
                label="Loaded weight"
                value={
                  load.loadedWeightMt ? formatWeight(load.loadedWeightMt) : null
                }
              />
              <Detail
                label="Final weight"
                value={
                  load.finalWeightMt ? formatWeight(load.finalWeightMt) : null
                }
              />
              <Detail
                label="Purchase rate"
                value={
                  load.purchaseRate
                    ? `${formatInr(load.purchaseRate)} / metric ton`
                    : null
                }
              />
              <Detail label="Challan number" value={load.challanNumber} />
              <Detail label="Weighment card" value={load.weighmentCardNumber} />
            </dl>
          </CardContent>
        </Card>
      </div>
      <CustomFieldsPanel
        target="TRIP_LOADING"
        recordId={load.id}
        fields={loadingFields.fields}
        documentContentLinks
      />
      <CustomFieldsPanel
        target="TRIP_DELIVERY"
        recordId={load.id}
        fields={deliveryFields.fields}
        documentContentLinks
      />
      <DocumentUploadCard
        targetType="TRIP"
        targetId={load.id}
        documentTypes={[
          "LOADING_PHOTO",
          "WEIGHBRIDGE_SLIP",
          "DELIVERY_CHALLAN",
          "PERMIT",
          "OTHER",
        ]}
        title="Add load document"
        onUploaded={() => router.invalidate({ sync: true })}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Load documents</h2>
        <VendorDocumentCards documents={documents.items} />
      </section>
    </div>
  )
}
