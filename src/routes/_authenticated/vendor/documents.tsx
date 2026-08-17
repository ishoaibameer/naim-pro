import type { FormEvent } from "react"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { VendorDocumentCards } from "@/components/vendor/vendor-document-cards"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"
import { vendorDocumentListSchema } from "@/server/vendor/schemas"
import { listVendorDocumentsFn } from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor/documents")({
  validateSearch: vendorDocumentListSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listVendorDocumentsFn({ data: deps }),
  component: VendorDocuments,
})

function VendorDocuments() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const vendor = Route.useRouteContext().vendorAuth.vendor
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: {
        tripId: String(form.get("tripId") ?? "") || undefined,
        documentType: String(
          form.get("documentType") ?? "ALL"
        ) as typeof search.documentType,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
      },
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vendor portal"
        title="Documents"
        description="Secure files attached to your profile, loads, deals, and payment receipts."
      />
      <DocumentUploadCard
        targetType="VENDOR"
        targetId={vendor.id}
        documentTypes={["PERMIT", "OTHER"]}
        title="Add vendor document"
        onUploaded={() => router.invalidate({ sync: true })}
      />
      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <NativeSelect name="tripId" defaultValue={search.tripId ?? ""}>
          <NativeSelectOption value="">All loads</NativeSelectOption>
          {data.tripOptions.map((trip) => (
            <NativeSelectOption key={trip.id} value={trip.id}>
              {trip.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="documentType" defaultValue={search.documentType}>
          <NativeSelectOption value="ALL">
            All document types
          </NativeSelectOption>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={search.from ?? ""}
          aria-label="From date"
        />
        <Input
          type="date"
          name="to"
          defaultValue={search.to ?? ""}
          aria-label="To date"
        />
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" /> Filter
        </Button>
      </form>
      <VendorDocumentCards documents={data.items} />
    </div>
  )
}
