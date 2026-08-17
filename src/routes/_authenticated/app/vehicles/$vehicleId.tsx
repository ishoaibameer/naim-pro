import { createFileRoute, useRouter } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { DocumentCards } from "@/components/documents/document-cards"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import {
  getDocumentMastersFn,
  listDocumentsForTargetFn,
} from "@/server/documents/document.functions"

export const Route = createFileRoute("/_authenticated/app/vehicles/$vehicleId")(
  {
    loader: async ({ params }) => {
      const [masters, documents] = await Promise.all([
        getDocumentMastersFn(),
        listDocumentsForTargetFn({
          data: { targetType: "VEHICLE", targetId: params.vehicleId },
        }),
      ])
      const vehicle = masters.VEHICLE.find(
        (item) => item.id === params.vehicleId
      )
      if (!vehicle) throw new Error("Vehicle not found.")
      return { vehicle, documents }
    },
    component: VehicleDocumentsPage,
  }
)

function VehicleDocumentsPage() {
  const { vehicle, documents } = Route.useLoaderData()
  const router = useRouter()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vehicle"
        title={vehicle.label}
        description="Master photo replacements keep immutable version history. Permits and other evidence remain separate records."
      />
      <DocumentUploadCard
        targetType="VEHICLE"
        targetId={vehicle.id}
        defaultDocumentType="VEHICLE_PHOTO"
        onUploaded={() => router.invalidate({ sync: true })}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vehicle documents</h2>
        <DocumentCards items={documents} />
      </section>
    </div>
  )
}
