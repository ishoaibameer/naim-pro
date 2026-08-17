import type { FormEvent } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { IconPlus, IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { DocumentCards } from "@/components/documents/document-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { DOCUMENT_TYPE_VALUES } from "@/server/db/schema/constants"
import {
  getDocumentMastersFn,
  listDocumentsFn,
} from "@/server/documents/document.functions"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"
import { documentListSchema } from "@/server/documents/schemas"

export const Route = createFileRoute("/_authenticated/app/documents/")({
  validateSearch: documentListSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [documents, masters] = await Promise.all([
      listDocumentsFn({ data: deps }),
      getDocumentMastersFn(),
    ])
    return { documents, masters }
  },
  component: DocumentsPage,
})

function DocumentsPage() {
  const { documents, masters } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({
      search: (previous) => ({
        ...previous,
        search: String(form.get("search") ?? ""),
        documentType: String(
          form.get("documentType") ?? "ALL"
        ) as typeof previous.documentType,
        vendorId: String(form.get("vendorId") ?? "") || undefined,
        tripId: String(form.get("tripId") ?? "") || undefined,
        vehicleId: String(form.get("vehicleId") ?? "") || undefined,
        paymentId: String(form.get("paymentId") ?? "") || undefined,
        billId: String(form.get("billId") ?? "") || undefined,
        uploadedByMembershipId:
          String(form.get("uploadedByMembershipId") ?? "") || undefined,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
        page: 1,
      }),
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Records"
        title="Documents"
        description="Private photos, evidence, receipts, challans, bills, and permits."
        actions={
          <Button
            render={<Link to="/app/documents/new" search={{}} />}
            nativeButton={false}
          >
            <IconPlus data-icon="inline-start" /> Add document
          </Button>
        }
      />
      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          name="search"
          defaultValue={search.search}
          placeholder="Title, file, or related record…"
        />
        <NativeSelect
          name="documentType"
          defaultValue={search.documentType}
          className="w-full"
        >
          <NativeSelectOption value="ALL">
            All document types
          </NativeSelectOption>
          {DOCUMENT_TYPE_VALUES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {DOCUMENT_TYPE_LABELS[type]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="vendorId"
          defaultValue={search.vendorId ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">All vendors</NativeSelectOption>
          {masters.VENDOR.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="tripId"
          defaultValue={search.tripId ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">All trips</NativeSelectOption>
          {masters.TRIP.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="vehicleId"
          defaultValue={search.vehicleId ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">All vehicles</NativeSelectOption>
          {masters.VEHICLE.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="uploadedByMembershipId"
          defaultValue={search.uploadedByMembershipId ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">All uploaders</NativeSelectOption>
          {masters.members.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="paymentId"
          defaultValue={search.paymentId ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">All payments</NativeSelectOption>
          {masters.PAYMENT.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="billId"
          defaultValue={search.billId ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">All bills</NativeSelectOption>
          {masters.BILL.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={search.from ?? ""}
          aria-label="Uploaded from"
        />
        <Input
          type="date"
          name="to"
          defaultValue={search.to ?? ""}
          aria-label="Uploaded to"
        />
        <Button type="submit" variant="outline">
          <IconSearch data-icon="inline-start" /> Filter
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {documents.total} document{documents.total === 1 ? "" : "s"}
      </p>
      <DocumentCards items={documents.items} />
    </div>
  )
}
